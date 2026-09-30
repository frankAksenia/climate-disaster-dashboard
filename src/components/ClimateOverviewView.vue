<template>
  <div class="line-chart-panel">
    <div class="primary-chart" ref="chart">
      <div class="chart-header" ref="chartHeader">
        <div>
          <div class="title">Temperature, CO₂ & Disasters</div>
        </div>
        <div class="legend">
          <div
            v-for="item in mainChartSeries"
            :key="item.key"
            class="legend-item"
          >
            <span
              class="legend-swatch"
              :style="{ backgroundColor: item.color }"
            ></span>
            {{ item.label }}
          </div>
        </div>
      </div>

      <svg :width="svgWidth" :height="svgHeight">
        <g :transform="`translate(${padding.left}, ${padding.top})`">
          <!-- x axis -->
          <g class="axis" :transform="`translate(0, ${yPlotRange.bottom})`">
            <line :x1="xPlotRange.left" :x2="xPlotRange.right" />
            <g v-for="tick in xTicks" :key="tick">
              <line :x1="xScale(tick)" :x2="xScale(tick)" y1="0" y2="6" />
              <text :x="xScale(tick)" y="20" text-anchor="middle">
                {{ tick }}
              </text>
            </g>
            <text
              class="axis-label x-label"
              :x="xPlotRange.right"
              y="32"
              text-anchor="end"
            >
              Year
            </text>
          </g>

          <!-- y axis left -->
          <g class="axis">
            <line :y1="yPlotRange.top" :y2="yPlotRange.bottom" />
            <g v-for="tick in yTicks" :key="tick">
              <line :y1="yScale(tick)" :y2="yScale(tick)" x1="-6" x2="0" />
              <text x="-10" :y="yScale(tick) + 4" text-anchor="end">
                {{ tick }}%
              </text>
            </g>
            <text
              class="axis-label y-label"
              :x="-padding.left - 10"
              :y="-55"
              text-anchor="middle"
              transform="rotate(-90)"
            >
              Change temp and disasters (%)
            </text>
          </g>
          <!-- y axis right -->
          <g class="axis">
            <line
              :x1="xPlotRange.right"
              :x2="xPlotRange.right"
              :y1="yPlotRange.top"
              :y2="yPlotRange.bottom"
            />
            <g v-for="tick in yTicksCo2" :key="`co2-${tick}`">
              <line
                :y1="yScaleCo2(tick)"
                :y2="yScaleCo2(tick)"
                :x1="xPlotRange.right"
                :x2="xPlotRange.right + 6"
              />
              <text
                :x="xPlotRange.right + 10"
                :y="yScaleCo2(tick) + 4"
                text-anchor="start"
              >
                {{ tick }}%
              </text>
            </g>
            <text
              class="axis-label"
              :x="xPlotRange.right + 0"
              :y="
                yPlotRange.top + (yPlotRange.bottom - yPlotRange.top) / 2 - 10
              "
              text-anchor="middle"
              :transform="`rotate(90, ${xPlotRange.right + 34}, ${
                yPlotRange.top + (yPlotRange.bottom - yPlotRange.top) / 2
              })`"
            >
              CO₂ change (%)
            </text>
          </g>

          <!-- grid -->
          <g class="grid">
            <line
              v-for="tick in yTicks"
              :key="`grid-${tick}`"
              :y1="yScale(tick)"
              :y2="yScale(tick)"
              :x2="xPlotRange.right"
            />
          </g>

          <!-- lines -->
          <g>
            <path
              v-for="item in mainChartSeries"
              :key="`line-${item.key}`"
              :d="linePath(item)"
              :stroke="item.color"
              fill="none"
              stroke-width="2"
            />
          </g>

          <!-- points -->
          <g class="dots">
            <g v-for="item in mainChartSeries" :key="`dots-${item.key}`">
              <circle
                v-for="pt in item.values"
                :key="`${item.key}-${pt.year}`"
                :cx="xScale(pt.year)"
                :cy="yScaleForKey(item.key)(pt.value)"
                r="3"
                :fill="item.color"
              />
            </g>
          </g>

          <!-- hover line -->
          <g v-if="hoverYear !== null" class="hover-layer">
            <line
              class="hover-line"
              :x1="xScale(hoverYear)"
              :x2="xScale(hoverYear)"
              :y1="yPlotRange.top"
              :y2="yPlotRange.bottom"
            />
          </g>
          <rect
            class="hover-overlay"
            :x="xPlotRange.left"
            :y="yPlotRange.top"
            :width="xPlotRange.right - xPlotRange.left"
            :height="yPlotRange.bottom - yPlotRange.top"
            @mousemove="handleHover"
            @mouseleave="clearHover"
          />
        </g>
      </svg>
    </div>
    <!-- small multiples -->
    <div class="small-multiples">
      <div v-for="small in smallCharts" :key="small.key" class="small-chart">
        <div class="small-header">
          <div class="small-title">
            <span
              class="legend-swatch"
              :style="{ backgroundColor: small.color }"
            ></span>
            {{ small.label }} YoY change
          </div>
          <div class="small-latest" v-if="Number.isFinite(small.latest)">
            {{ d3.format("+.1f")(small.latest) }} %
          </div>
        </div>
        <svg
          :viewBox="`0 0 ${smallChartWidth} ${smallChartHeight}`"
          preserveAspectRatio="none"
        >
          <g
            :transform="`translate(${smallPadding.left}, ${smallPadding.top})`"
          >
            <!-- x axes -->
            <g class="axis" :transform="`translate(0, ${smallInnerHeight})`">
              <line :x1="0" :x2="smallInnerWidth" />
              <g v-for="tick in smallXTicks" :key="tick">
                <line
                  :x1="smallXScale(tick)"
                  :x2="smallXScale(tick)"
                  y1="0"
                  y2="4"
                />
                <text :x="smallXScale(tick)" y="16" text-anchor="middle">
                  {{ tick }}
                </text>
              </g>
            </g>
            <!-- y axes -->
            <g class="axis">
              <line :y1="0" :y2="smallInnerHeight" />
              <g v-for="tick in small.yTicks" :key="`${small.key}-${tick}`">
                <line
                  :y1="small.yScale(tick)"
                  :y2="small.yScale(tick)"
                  x1="-4"
                  x2="0"
                />
                <text x="-8" :y="small.yScale(tick) + 4" text-anchor="end">
                  {{ d3.format("+.1f")(tick) }}
                </text>
              </g>
            </g>
            <!-- grid -->
            <g class="grid">
              <line
                v-for="tick in small.yTicks"
                :key="`grid-${small.key}-${tick}`"
                :y1="small.yScale(tick)"
                :y2="small.yScale(tick)"
                :x2="smallInnerWidth"
              />
            </g>
            <!-- lines -->
            <path
              v-if="small.values.length"
              :d="smallLinePath(small)"
              :stroke="small.color"
              fill="none"
              stroke-width="2"
            />
            <!-- dots -->
            <g class="dots">
              <template v-for="pt in small.values" :key="`${small.key}-${pt.year}`">
                <circle
                  v-if="Number.isFinite(pt.value)"
                  :cx="smallXScale(pt.year)"
                  :cy="small.yScale(pt.value)"
                  r="2.5"
                  :fill="small.color"
                />
              </template>
            </g>
            <!-- vertical hover line -->
            <line
              v-if="hoverYear !== null"
              class="hover-line"
              :x1="smallXScale(hoverYear)"
              :x2="smallXScale(hoverYear)"
              y1="0"
              :y2="smallInnerHeight"
            />
          </g>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import * as d3 from "d3";
import { useStore } from "@/stores/store.js";

const store = useStore();
const chart = ref(null);
const chartHeader = ref(null);
const hoverYear = ref(null);

const padding = { top: 12, right: 64, bottom: 44, left: 56 };
const svgWidth = ref(640);
const svgHeight = ref(200);

const smallChartWidth = 260;
const smallChartHeight = 120;
const smallPadding = { top: 6, right: 6, bottom: 20, left: 34 };
const smallInnerWidth = computed(
  () => smallChartWidth - smallPadding.left - smallPadding.right
);
const smallInnerHeight = computed(
  () => smallChartHeight - smallPadding.top - smallPadding.bottom
);

const innerWidth = computed(
  () => svgWidth.value - padding.left - padding.right
);
const innerHeight = computed(
  () => svgHeight.value - padding.top - padding.bottom
);

const xPlotRange = computed(() => {
  const inner = innerWidth.value;
  const rightPad = 16;
  return {
    left: 0,
    right: Math.max(0, inner - rightPad),
  };
});

const allYears = computed(() =>
  store.commonYearlySeries.map((entry) => entry.year)
);
const selectedCountriesSet = computed(() => new Set(store.selectedCountries));
const selectionMetrics = new Set(["temperature", "disasters"]);
const valueForMetric = (yearEntry, selectionMap, metric) =>
  selectionMap && selectionMetrics.has(metric)
    ? selectionMap.get(yearEntry.year)?.[metric]
    : yearEntry[metric];

const seriesForSelectionByYear = computed(() => {
  const selectedCountries = store.disAndTempCountrySeries.filter((entry) =>
    selectedCountriesSet.value.has(entry.iso3)
  );
  if (!selectedCountries.length) return null;
  const seriesMap = new Map();
  allYears.value.forEach((year) => {
    const temperatureValues = selectedCountries.map(
      (eachCountry) => eachCountry.temperature?.[year]
    );
    const disasterValues = selectedCountries.map(
      (eachCountry) => eachCountry.disasters?.[year]
    );
    seriesMap.set(year, {
      temperature: d3.mean(temperatureValues),
      disasters: d3.mean(disasterValues),
    });
  });
  return seriesMap;
});

const getBaselineValues = computed(() => {
  const selectionMap = seriesForSelectionByYear.value;
  const findBaseline = (metric) => {
    for (const yearEntry of store.commonYearlySeries) {
      const value = valueForMetric(yearEntry, selectionMap, metric);
      if (Number.isFinite(value) && value !== 0) {
        return value;
      }
    }
    return null;
  };
  return {
    temperature: findBaseline("temperature"),
    co2: findBaseline("co2"),
    disasters: findBaseline("disasters"),
  };
});

// values as % change relative to baseline
const normalisedTrend = computed(() => {
  const baselineValues = getBaselineValues.value;
  const selectionMap = seriesForSelectionByYear.value;
  const toPercentChange = (value, baseline) => {
    if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0)
      return null;
    return ((value - baseline) / baseline) * 100;
  };
  return store.commonYearlySeries.map((yearEntry) => {
    const temperatureValue = valueForMetric(
      yearEntry,
      selectionMap,
      "temperature"
    );
    const disasterValue = valueForMetric(yearEntry, selectionMap, "disasters");
    return {
      year: yearEntry.year,
      temperature: toPercentChange(
        temperatureValue,
        baselineValues.temperature
      ),
      co2: toPercentChange(yearEntry.co2, baselineValues.co2),
      disasters: toPercentChange(disasterValue, baselineValues.disasters),
    };
  });
});

const xDomain = [1980, 2025];

const buildDomain = (values, fallback = [0, 1]) => {
  const numericValues = values.filter((value) => Number.isFinite(value));
  if (!numericValues.length) return fallback;
  const [min, max] = d3.extent(numericValues);
  const span = Math.max(1, max - min);
  const pad = span * 0.15;
  const low = Math.min(min - pad, 0);
  const high = Math.max(max + pad, 0);
  return [low, high];
};

const yDomain = computed(() =>
  buildDomain(
    normalisedTrend.value.flatMap((d) => [d.temperature, d.disasters])
  )
);

const yDomainCo2 = computed(() =>
  buildDomain(
    normalisedTrend.value.map((d) => d.co2),
    yDomain.value
  )
);

const yPlotRange = computed(() => {
  const inner = innerHeight.value;
  const offset = (inner - inner * 0.85) / 2;
  return {
    top: offset,
    bottom: inner - offset,
  };
});

const xScale = computed(() =>
  d3
    .scaleLinear()
    .domain(xDomain)
    .range([xPlotRange.value.left, xPlotRange.value.right])
);

const yScale = computed(() =>
  d3
    .scaleLinear()
    .domain(yDomain.value)
    .range([yPlotRange.value.bottom, yPlotRange.value.top])
);

const yScaleCo2 = computed(() =>
  d3
    .scaleLinear()
    .domain(yDomainCo2.value)
    .range([yPlotRange.value.bottom, yPlotRange.value.top])
);

const xTicks = computed(() => {
  return xScale.value.ticks(10);
});

const yTicks = computed(() => {
  return yScale.value.ticks(5);
});

const yTicksCo2 = computed(() => {
  return yScaleCo2.value.ticks(5);
});

const smallXScale = computed(() =>
  d3.scaleLinear().domain(xDomain).range([0, smallInnerWidth.value])
);

const smallXTicks = computed(() => {
  return smallXScale.value.ticks(6);
});

const mainChartSeries = computed(() => {
  const makeSeries = (metric) =>
    normalisedTrend.value.map((d) => ({ year: d.year, value: d[metric] }));

  return [
    { key: "temperature", label: "Temperature", color: "#e85d04" },
    { key: "co2", label: "CO₂ concentration", color: "#2563eb" },
    { key: "disasters", label: "Disasters", color: "#0f9d58" },
  ].map((item) => ({ ...item, values: makeSeries(item.key) }));
});

const yScaleForKey = (key) => (key === "co2" ? yScaleCo2.value : yScale.value);

const smallCharts = computed(() => {
  const computeYoY = (key) => {
    const out = [];
    let prev = null;
    for (const d of normalisedTrend.value) {
      const v = d[key];
      if (!Number.isFinite(v) || !Number.isFinite(prev)) {
        out.push({ year: d.year, value: null });
      } else {
        out.push({ year: d.year, value: v - prev });
      }
      prev = Number.isFinite(v) ? v : prev;
    }
    return out;
  };

  const buildChart = (key, label, color) => {
    const values = computeYoY(key);
    const numericValues = values
      .map((point) => point.value)
      .filter((value) => Number.isFinite(value));
    const [min, max] =
      numericValues.length > 0 ? d3.extent(numericValues) : [0, 1];
    const span = Math.max(1, max - min);
    const pad = span * 0.2;
    const scaleY = d3
      .scaleLinear()
      .domain([min - pad, max + pad])
      .range([smallInnerHeight.value, 0]);
    const latest = values[values.length - 1]?.value ?? null;
    return {
      key,
      label,
      color,
      values,
      yScale: scaleY,
      yTicks: scaleY.ticks(4),
      latest,
    };
  };
  return [
    buildChart("temperature", "Temperature", "#e85d04"),
    buildChart("co2", "CO₂ concentration", "#2563eb"),
    buildChart("disasters", "Disasters", "#0f9d58"),
  ];
});

const linePath = (item) => {
  const scale = yScaleForKey(item.key);
  const line = d3
    .line()
    .defined((d) => d.value !== null)
    .x((d) => xScale.value(d.year))
    .y((d) => scale(d.value));
  return line(item.values);
};

const smallLinePath = (chart) => {
  const line = d3
    .line()
    .defined((d) => Number.isFinite(d.value))
    .x((d) => smallXScale.value(d.year))
    .y((d) => chart.yScale(d.value));
  return line(chart.values);
};

const updateDimensions = () => {
  const headerHeight = chartHeader.value?.clientHeight || 0;
  const containerHeight = chart.value.clientHeight || svgHeight.value;
  const availableHeight = containerHeight - headerHeight - 8;
  svgWidth.value = chart.value.clientWidth;
  svgHeight.value = Math.max(150, availableHeight);
};

const handleHover = (event) => {
  const [mx, my] = d3.pointer(event);
  const { left, right } = xPlotRange.value;
  const { top, bottom } = yPlotRange.value;
  if (mx < left || mx > right || my < top || my > bottom) return clearHover();
  const year = Math.round(xScale.value.invert(mx));
  hoverYear.value = Math.min(xDomain[1], Math.max(xDomain[0], year));
};

const clearHover = () => {
  hoverYear.value = null;
};

onMounted(() => {
  updateDimensions();
});
</script>

<style scoped>
.line-chart-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.primary-chart,
.small-chart {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #d6e2f0;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.primary-chart {
  min-height: 200px;
  overflow: visible;
  position: relative;
}

.small-multiples {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.small-chart {
  min-height: 120px;
  border: 1px solid #d6e2f0;
  border-radius: 10px;
  background: linear-gradient(180deg, #f9fbff 0%, #f1f5f9 100%);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.small-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #334155;
  gap: 8px;
}

.small-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 11px;
}

.small-latest {
  font-size: 11px;
  color: #0f1b2c;
  font-weight: 600;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 14px;
  font-weight: 700;
  color: #0f1b2c;
}

.legend {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #334155;
}

.legend-swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.axis line {
  stroke: #cbd5e1;
  stroke-width: 1;
}

.axis text {
  font-size: 10px;
  fill: #475569;
}

.axis-label {
  font-size: 12px;
  fill: #334155;
}

.x-label {
  dominant-baseline: hanging;
}

.y-label {
  dominant-baseline: middle;
}

.grid line {
  stroke: #e2e8f0;
  stroke-dasharray: 4 4;
}

.dots circle {
  stroke: #f8fafc;
  stroke-width: 1.5;
}

.hover-line {
  stroke: #1e293b;
  stroke-width: 1;
  stroke-dasharray: 4 4;
  opacity: 0.7;
  pointer-events: none;
}

.hover-overlay {
  fill: transparent;
  cursor: crosshair;
}
</style>
