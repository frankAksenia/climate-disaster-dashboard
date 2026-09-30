import { defineStore } from "pinia";
import * as d3 from "d3";

const YEAR_START = 1980;
const YEAR_END = 2024;
const LCT_YEAR_START = 1994;
const LCT_YEAR_END = 2023;
const TEMPERATURE_BASELINE_START = 1961;
const TEMPERATURE_BASELINE_END = 1990;

export const useStore = defineStore({
  id: "main",
  state: () => ({
    selectedCountries: [],
    disastersAveragePerCountry: [],
    temperatureChangeAveragePerCountry: [],
    disAndTempCountrySeries: [],
    commonYearlySeries: [],
    countryMatrixBuckets: [],
    earlyWarningPerCountry: [],
  }),
  actions: {
    async loadData() {
      const disastersRaw = await d3.csv(
        "./14_Climate-related_Disasters_Frequency.csv"
      );
      const temperatureChangePerCountry = await d3.csv(
        "./23_Annual_Surface_Temperature_Change.csv"
      );
      const carbonTradeRaw = await d3.csv(
        "11_Trade_in_Low_Carbon_Technology_Products.csv"
      );
      const atmosphericCO2Raw = await d3.csv(
        "24_Atmospheric_CO2_Concentrations.csv"
      );
      const areaAndContinentRaw = await d3.csv("./world_population.csv");

      // filter indicator
      const disastersTotalPerCountry = disastersRaw.filter(
        (eachRow) =>
          eachRow.Indicator.toLowerCase().includes(
            "number of disasters: total"
          ) && // use only total number of disasters from dataset
          eachRow.ISO3 &&
          eachRow.Country
      );

      const buildYearRangeNumbers = (start, end) =>
        Array.from({ length: end - start + 1 }, (_, idx) => start + idx);

      const commonYearsList = buildYearRangeNumbers(YEAR_START, YEAR_END);
      const temperatureBaselineYearsList = buildYearRangeNumbers(
        TEMPERATURE_BASELINE_START,
        TEMPERATURE_BASELINE_END
      );
      const lctYearsList = buildYearRangeNumbers(LCT_YEAR_START, LCT_YEAR_END);

      // ************** Scatterplot  **************

      // caggregate mean
      const getMeanOverYears = (eachCountryRow, years) =>
        d3.mean(years.map((eachYear) => Number(eachCountryRow[eachYear])));

      const getCountryAreaAndContinentByIso = new Map(
        areaAndContinentRaw.map((eachCountryRow) => {
          const iso3 = eachCountryRow.CCA3;
          return [
            iso3,
            {
              area: eachCountryRow["Area (km²)"],
              continent: eachCountryRow.Continent,
            },
          ];
        })
      );

      this.disastersAveragePerCountry = disastersTotalPerCountry.map(
        (eachCountry) => ({
          country: eachCountry.Country,
          iso3: eachCountry.ISO3,
          average: getMeanOverYears(eachCountry, commonYearsList),
        })
      );

      this.temperatureChangeAveragePerCountry = temperatureChangePerCountry.map(
        (eachCountry) => {
          const baseline = getMeanOverYears(
            eachCountry,
            temperatureBaselineYearsList
          );
          const rawAverage = getMeanOverYears(eachCountry, commonYearsList);
          return {
            country: eachCountry.Country,
            iso3: eachCountry.ISO3,
            area:
              getCountryAreaAndContinentByIso.get(eachCountry.ISO3)?.area ??
              null,
            continent:
              getCountryAreaAndContinentByIso.get(eachCountry.ISO3)
                ?.continent ?? null,
            average: rawAverage - baseline,
          };
        }
      );

      // ************** Line Charts **************
      const getYearMap = (eachRow) =>
        Object.fromEntries(
          commonYearsList.map((year) => [year, Number(eachRow[year])])
        );

      const seriesByIso = new Map();

      const attachSeries = (countryRows, key) => {
        countryRows.forEach((eachCountryRow) => {
          const iso3 = eachCountryRow.ISO3;
          const entry = seriesByIso.get(iso3) || {
            country: eachCountryRow.Country,
            iso3,
            disasters: {},
            temperature: {},
          };
          entry.iso3 = iso3;
          entry[key] = getYearMap(eachCountryRow);
          seriesByIso.set(iso3, entry);
        });
      };

      attachSeries(disastersTotalPerCountry, "disasters");
      attachSeries(temperatureChangePerCountry, "temperature");
      this.disAndTempCountrySeries = Array.from(seriesByIso.values());

      // ************** Matrix **************

      // filter indicator
      const carbonImportsPerCountry = carbonTradeRaw.filter((eachRow) => {
        return String(eachRow.Indicator)
          .toLowerCase()
          .includes(
            "imports of low carbon technology products as percent of gdp"
          );
      });

      // convert CO2 monthly to yearly by average
      const averageCO2ByYear = d3.rollup(
        atmosphericCO2Raw,
        (eachYearsRecord) =>
          d3.mean(eachYearsRecord.map((value) => Number(value.Value))),
        (value) => String(value.Date).slice(0, 4)
      );

      // ************** Line Charts **************
      this.commonYearlySeries = commonYearsList.map((eachYear) => {
        const eachYearKey = String(eachYear);
        const disasterTotalAllCountries = disastersTotalPerCountry.reduce(
          (total, eachRow) => {
            return total + Number(eachRow[eachYearKey]);
          },
          0
        );
        return {
          year: eachYear,
          disasters: disasterTotalAllCountries,
          temperature: Number(
            temperatureChangePerCountry.find((row) => row.ISO3 === "WLD")[
              eachYearKey
            ]
          ),
          co2: averageCO2ByYear.get(eachYearKey),
        };
      });

      // ************** Infographic + early warning **************

      // Trend is percent change from first to last: (last-first)/|first| * 100
      // Slope is linear change per year: (last-first)/(lastYear-firstYear)
      // Forecast projects 5 years ahead: current + slope * 5
      const getForecastStats = (yearSeries) => {
        if (!yearSeries.length) return null;
        const first = yearSeries[0];
        const last = yearSeries[yearSeries.length - 1];
        const current = last.value;

        const trend =
          ((last.value - first.value) / Math.abs(first.value)) * 100;
        const slope = (last.value - first.value) / (last.year - first.year);
        const forecast = current + slope * 5;

        return { current, trend, forecast };
      };

      const buildSeriesFromRow = (eachCountryRow, years = commonYearsList) =>
        years.map((eachYear) => ({
          year: eachYear,
          value: Number(eachCountryRow[String(eachYear)]),
        }));

      const countryNamesMap = new Map(
        [...seriesByIso.entries()].map(([iso3, entry]) => [iso3, entry.country])
      );

      const co2Series = this.commonYearlySeries.map((entry) => ({
        year: entry.year,
        value: entry.co2,
      }));

      const globalCO2ForecastStats = getForecastStats(co2Series);

      // ************** Matrix **************

      // % change from first non-zero to last value
      const getDisasterGrowthPerCountry = (yearSeries) => {
        const values = yearSeries.map((point) => point.value);

        const firstNonZero = values.find((value) => value !== 0);
        const firstVal = firstNonZero ?? values[0];
        const lastVal = values[values.length - 1];

        return ((lastVal - firstVal) / firstVal) * 100;
      };

      // matrix buckets for table
      const lctImportsByCountry = carbonImportsPerCountry.map((row) => {
        const yearlyValues = lctYearsList.map((year) =>
          Number(row[String(year)])
        );
        const importMean = d3.mean(yearlyValues);
        return {
          country: row.Country,
          iso3: row.ISO3,
          importMean,
        };
      });

      const importMeanByIso = new Map(
        lctImportsByCountry.map((row) => [row.iso3, row.importMean])
      );

      const combinedImportAndDisasterGrowth = disastersTotalPerCountry
        .map((row) => {
          const importMean = importMeanByIso.get(row.ISO3) ?? null;
          const disasterGrowth = getDisasterGrowthPerCountry(
            buildSeriesFromRow(row, lctYearsList)
          );
          return {
            country: row.Country,
            iso3: row.ISO3,
            importMean,
            disasterGrowth,
          };
        })
        .filter(
          (d) =>
            d.importMean !== null &&
            d.disasterGrowth !== null &&
            d.iso3 &&
            d.country
        );

      const getQuartileIndex = (value, values) => {
        const sorted = [...values].sort((a, b) => a - b);
        const q1 = d3.quantileSorted(sorted, 0.25);
        const q2 = d3.quantileSorted(sorted, 0.5);
        const q3 = d3.quantileSorted(sorted, 0.75);
        if (value <= q1) return 1;
        if (value <= q2) return 2;
        if (value <= q3) return 3;
        return 4;
      };

      this.countryMatrixBuckets = combinedImportAndDisasterGrowth.map(
        (eachCountry) => ({
          country: eachCountry.country,
          iso3: eachCountry.iso3,
          importIntensity: eachCountry.importMean,
          disasterGrowth: eachCountry.disasterGrowth,
          importQuartile: getQuartileIndex(
            eachCountry.importMean,
            combinedImportAndDisasterGrowth.map((c) => c.importMean)
          ),
          growthQuartile: getQuartileIndex(
            eachCountry.disasterGrowth,
            combinedImportAndDisasterGrowth.map((c) => c.disasterGrowth)
          ),
        })
      );

      // ************** Infographic + early warning **************

      const disasterRowByIso = new Map(
        disastersTotalPerCountry.map((row) => [row.ISO3, row])
      );

      const temperatureRowByIso = new Map(
        temperatureChangePerCountry.map((row) => [row.ISO3, row])
      );

      this.earlyWarningPerCountry = Array.from(countryNamesMap.entries()).map(
        ([iso3, country]) => {
          const disasterRow = disasterRowByIso.get(iso3);
          const temperatureRow = temperatureRowByIso.get(iso3);
          const disastersSeries = disasterRow
            ? buildSeriesFromRow(disasterRow)
            : [];
          const temperatureSeries = temperatureRow
            ? buildSeriesFromRow(temperatureRow)
            : [];
          const disastersStats = getForecastStats(disastersSeries);
          const temperatureStats = getForecastStats(temperatureSeries);
          return {
            iso3,
            country,
            disasters: disastersStats,
            temperature: temperatureStats,
            co2: { ...globalCO2ForecastStats, global: true },
          };
        }
      );
    },

    setSelectedCountries(countries) {
      this.selectedCountries = Array.isArray(countries) ? [...countries] : [];
    },
  },
  getters: {
    getDisastersAveragePerCountry(state) {
      return state.disastersAveragePerCountry;
    },
    getTemperatureChangeAveragePerCountry(state) {
      return state.temperatureChangeAveragePerCountry;
    },
    getTemperatureBaseline() {
      return {
        start: TEMPERATURE_BASELINE_START,
        end: TEMPERATURE_BASELINE_END,
      };
    },
    getGlobalSummary(state) {
      if (!state.commonYearlySeries.length) return null;
      const temperatureSeries = state.commonYearlySeries.map((d) => ({
        year: d.year,
        value: d.temperature,
      }));
      const disastersSeries = state.commonYearlySeries.map((d) => ({
        year: d.year,
        value: d.disasters,
      }));
      const co2Series = state.commonYearlySeries
        .map((d) => ({ year: d.year, value: Number(d.co2) }))
        .filter((point) => Number.isFinite(point.value));
      return {
        temperature: getForecastStats(temperatureSeries),
        disasters: getForecastStats(disastersSeries),
        co2: { ...getForecastStats(co2Series) },
      };
    },
  },
});
