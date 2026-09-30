<template>
  <div class="early-warning">
    <div v-if="selectedEntry">
      <div class="single-card">
        <!-- selection controls and active selection -->
        <div class="card-top">
          <div class="control-row compact">
            <label v-if="!selectionInfo.isMulti" class="control-label compact"
              >Country</label
            >
            <select
              v-if="!selectionInfo.isMulti"
              v-model="selectedCountry"
              class="country-select compact"
              @change="linkedToSelection = false"
            >
              <option value="">World</option>
              <option
                v-for="option in countryOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            <!-- selection list with tooltip for countries -->
            <div v-if="selectionInfo.label" class="selection-wrapper">
              <span class="chip">{{ selectionInfo.label }}</span>
              <div class="selection-tooltip">
                <div class="selection-title">Selected countries</div>
                <div
                  v-for="country in selectedCountryLabels"
                  :key="country"
                  class="selection-item"
                >
                  {{ country }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card-columns">
          <!-- donut summary and legend -->
          <div class="donut-panel">
            <svg class="donut" viewBox="0 0 240 240" role="presentation">
              <g transform="translate(120, 120)">
                <g class="rings" transform="rotate(-90)">
                  <g v-for="ring in getDonutRing" :key="ring.key">
                    <circle class="ring-track" :r="ring.radius" />
                    <circle
                      class="ring"
                      :class="{
                        empty: !Number.isFinite(ring.value),
                        negative: Number.isFinite(ring.value) && ring.value < 0,
                      }"
                      :style="{ stroke: ring.color }"
                      :r="ring.radius"
                      :stroke-dasharray="
                        ringDasharray(
                          ring.radius,
                          segmentValue(ring.key, ring.value)
                        )
                      "
                    />
                  </g>
                </g>
                <text class="donut-center-label" y="-8">Forecast (5y)</text>
                <text class="donut-center-value" y="16">{{ mainForecastValue }}</text>
              </g>
            </svg>
            <div class="legend">
              <div
                v-for="ring in getDonutRing"
                :key="`legend-${ring.key}`"
                class="legend-item"
              >
                <span
                  class="legend-swatch"
                  :style="{ backgroundColor: ring.color }"
                ></span>
                <div>
                  <div class="legend-label">{{ ring.label }}</div>
                  <div class="legend-value">
                    {{ formatForecastPercent(ring.key, ring.value) }}
                    <span v-if="selectedEntry[ring.key]?.global" class="chip"
                      >Global</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- current/trend/forecast table -->
          <div class="stat-grid">
            <div
              v-for="cat in categoryStyles"
              :key="`stat-${cat.key}`"
              class="stat-card"
              :style="{ '--accent': cat.color, '--tint': cat.tint }"
            >
              <div class="stat-card-title">{{ cat.label }}</div>
              <div class="stat-row">
                <div
                  v-for="metric in metricKeys"
                  :key="`stat-${cat.key}-${metric}`"
                  class="stat-chip"
                >
                  <div class="stat-label">{{ metricLabels[metric] }}</div>
                  <div
                    class="stat-value"
                    :class="
                      metric === 'trend'
                        ? trendClass(selectedEntry[cat.key]?.trend)
                        : null
                    "
                  >
                    {{
                      formatValue(
                        cat.key,
                        metric,
                        selectedEntry[cat.key]?.[metric]
                      )
                    }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import * as d3 from "d3";
import { useStore } from "@/stores/store.js";

const store = useStore();

const categoryStyles = [
  { key: "co2", label: "CO₂ concentration", color: "#2563eb", tint: "#e0ecff" },
  {
    key: "temperature",
    label: "Temperature change",
    color: "#e85d04",
    tint: "#ffe7d6",
  },
  {
    key: "disasters",
    label: "Climate disasters",
    color: "#0f9d58",
    tint: "#d8f5e7",
  },
];
const metricKeys = ["current", "trend", "forecast"];
const metricLabels = {
  current: "Current",
  trend: "Trend",
  forecast: "Forecast",
};

const trendClass = (value) => ({
  positive: Number.isFinite(value) && value > 0,
  negative: Number.isFinite(value) && value < 0,
});

const selectedCountry = ref("");

const linkedToSelection = ref(false); // track if multiple countries are selected

// build the dropdown list
const countryOptions = computed(() =>
  (store.earlyWarningPerCountry || [])
    .filter((d) => d.iso3 !== "WORLD")
    .map((d) => ({ value: d.iso3, label: d.country }))
    .sort((a, b) => a.label.localeCompare(b.label))
);

const countryNameByIso = computed(
  () =>
    new Map(
      (store.earlyWarningPerCountry || []).map((entry) => [
        entry.iso3,
        entry.country,
      ])
    )
);

const selectedCountryLabels = computed(() =>
  store.selectedCountries.map(
    (iso3) => countryNameByIso.value.get(iso3) || iso3
  )
);

// watch changed in selected countries
watch(
  () => store.selectedCountries,
  (countries) => {
    if (!countries.length || !countryOptions.value.length) {
      linkedToSelection.value = false;
      selectedCountry.value = ""; // reset to world
      return;
    }
    const matches = countryOptions.value.filter((opt) =>
      countries.includes(opt.value)
    );
    if (matches.length) {
      selectedCountry.value = matches[0].value; // set to selected dot from scatter
      linkedToSelection.value = true;
    }
  },
  { immediate: true }
);

// summary of selection state for selection list and label text
const selectionInfo = computed(() => {
  const count = store.selectedCountries.length;
  const linked = linkedToSelection.value;
  return {
    count,
    isMulti: linked && count > 1,
    label:
      !linked || count === 0
        ? ""
        : count > 1
        ? `Selection (${count})`
        : "From selection",
  };
});

const buildMetricBlock = (entries, categoryKey) => {
  const computeAverageMetricForSelected = (metric) => {
    const values = entries
      .map((entry) => entry?.[categoryKey]?.[metric])
      .filter((val) => Number.isFinite(val));
    return values.length ? d3.mean(values) : null;
  };
  const block = Object.fromEntries(
    metricKeys.map((metric) => [
      metric,
      computeAverageMetricForSelected(metric),
    ])
  );
  if (categoryKey === "co2" && entries.every((entry) => entry?.co2?.global)) {
    return { ...block, global: true };
  }
  return block;
};

const aggregatedEntry = (entries) => ({
  iso3: "MULTI",
  country: `Selected (${entries.length})`,
  temperature: buildMetricBlock(entries, "temperature"),
  disasters: buildMetricBlock(entries, "disasters"),
  co2: buildMetricBlock(entries, "co2"),
});

const getEntryByIso = (entries, iso3) =>
  entries.find((item) => item.iso3 === iso3);

const buildWorldEntry = (entries) => {
  const aggregated = aggregatedEntry(entries);
  return { ...aggregated, iso3: "WLD", country: "World" };
};

// display data according to curent selection
const selectedEntry = computed(() => {
  const allEntries = (store.earlyWarningPerCountry || []).filter(Boolean);
  const fallback = buildWorldEntry(allEntries) || store.getGlobalSummary;

  if (linkedToSelection.value) {
    const selected = store.selectedCountries;
    if (selected.length > 1) {
      const entries = selected.map((iso3) => getEntryByIso(allEntries, iso3));
      if (entries.length) return aggregatedEntry(entries);
    } else if (selected.length === 1) {
      return (
        getEntryByIso(allEntries, selected[0]) ||
        getEntryByIso(allEntries, selectedCountry.value) ||
        fallback
      );
    }
  }

  if (!selectedCountry.value || selectedCountry.value === "WORLD") {
    return fallback;
  }

  return getEntryByIso(allEntries, selectedCountry.value) || fallback;
});

const getDonutRing = computed(() => {
  const radiuses = [92, 72, 52];
  return categoryStyles.map((category, idx) => ({
    ...category,
    radius: radiuses[idx] || radiuses[radiuses.length - 1],
    value: selectedEntry.value?.[category.key]?.forecast ?? null,
  }));
});

const buildRange = (values) => {
  const [min, max] = d3.extent(values.filter((val) => Number.isFinite(val)));
  return { min, max, span: max - min || 1 };
};

const categoryRanges = computed(() => {
  return Object.fromEntries(
    categoryStyles.map((category) => [
      category.key,
      buildRange(
        category.key === "co2"
          ? (store.commonYearlySeries || []).map((entry) => entry?.co2)
          : (store.earlyWarningPerCountry || []).map(
              (entry) => entry?.[category.key]?.forecast
            )
      ),
    ])
  );
});

// rescale values for the donut
const segmentValue = (category, value) => {
  const range = categoryRanges.value[category];
  const clamped = Math.min(range.max, Math.max(range.min, value));
  return (clamped - range.min) / range.span;
};

// render a partial ring for the ratio
const ringDasharray = (radius, ratio) => {
  const c = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const drawn = clamped * c;
  return `${drawn} ${Math.max(c - drawn, 0)}`;
};

const mainForecastValue = computed(() => {
  const entry = selectedEntry.value;
  if (!entry) return "—";
  const candidates = categoryStyles.map((category) => ({
    key: category.key,
    value: entry[category.key]?.forecast,
    global: entry[category.key]?.global,
  }));
  const nonGlobal = candidates.filter((item) => !item.global);
  const list = nonGlobal.length ? nonGlobal : candidates;
  for (const item of list) {
    if (Number.isFinite(item.value)) {
      return formatForecastPercent(item.key, item.value);
    }
  }
  return "—";
});

const formatForecastPercent = (categoryKey, value) => {
  if (!Number.isFinite(value)) return "—";
  const pct = segmentValue(categoryKey, value) * 100;
  return `${d3.format(".0f")(pct)}%`;
};

const valueFormatters = {
  co2: (value) => `${d3.format(".1f")(value)} ppm`,
  temperature: (value) =>
    `${value >= 0 ? "+" : ""}${d3.format(".2f")(value)}°C`,
  disasters: (value) => d3.format(".1f")(value),
};

const formatValue = (categoryKey, metricKey, value) => {
  if (!Number.isFinite(value)) return "—";
  if (metricKey === "trend") {
    return `${value >= 0 ? "+" : ""}${d3.format(".1f")(value)}%`;
  }
  return (valueFormatters[categoryKey] || d3.format(".1f"))(value);
};
</script>

<style scoped>
.early-warning {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.control-row.compact {
  width: 100%;
}

.control-label {
  font-size: 11px;
  color: #475569;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.control-label.compact {
  font-size: 10px;
  letter-spacing: 0.02em;
}

.country-select {
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #fff;
  font-size: 12px;
  color: #0f172a;
  min-width: 140px;
}

.country-select.compact {
  padding: 4px 6px;
  font-size: 11px;
  min-width: 110px;
  max-width: 200px;
  flex: 0 1 45%;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #0f172a;
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.selection-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.selection-tooltip {
  position: absolute;
  top: 28px;
  left: 0;
  z-index: 10;
  width: 220px;
  max-height: 220px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 10px;
  border-radius: 8px;
  background: #0f172a;
  color: #f8fafc;
  font-size: 11px;
  line-height: 1.4;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.2);
  opacity: 0;
  pointer-events: auto;
  transition: opacity 0.2s ease;
}

.selection-wrapper:hover .selection-tooltip,
.selection-wrapper:focus-within .selection-tooltip,
.selection-tooltip:hover {
  opacity: 1;
}

.selection-title {
  font-weight: 700;
  margin-bottom: 4px;
}

.selection-item {
  white-space: nowrap;
}

.single-card {
  background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
  border: 1px solid #d7e0eb;
  border-radius: 14px;
  padding: 10px;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  overflow: hidden;
  flex-wrap: nowrap;
  align-items: stretch;
}

.card-top {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.card-columns {
  display: flex;
  gap: 10px;
  align-items: stretch;
  flex-wrap: nowrap;
}

.donut-panel {
  flex: 0 1 35%;
  min-width: 220px;
  max-width: 40%;
  z-index: 1;
}

.donut {
  width: 100%;
  height: 200px;
}

.legend {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 6px;
}

.legend-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px;
  align-items: center;
}

.legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-label {
  font-size: 11px;
  font-weight: 600;
  color: #0f172a;
}

.legend-value {
  font-size: 11px;
  color: #475569;
  display: flex;
  gap: 4px;
  align-items: center;
}

.rings circle {
  fill: none;
  stroke-linecap: round;
  transform-origin: center;
}

.ring-track {
  stroke: rgba(148, 163, 184, 0.4);
  stroke-width: 12;
}

.ring {
  stroke: var(--accent);
  stroke-width: 12;
  transition: stroke-dasharray 0.2s ease, opacity 0.2s ease;
}

.donut-center-label {
  text-anchor: middle;
  font-size: 11px;
  fill: #475569;
  letter-spacing: 0.06em;
}

.donut-center-value {
  text-anchor: middle;
  font-size: 14px;
  font-weight: 700;
  fill: #0f172a;
}

.stat-grid {
  flex: 1 1 65%;
  min-width: 280px;
  max-width: 65%;
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  z-index: 1;
}

.stat-card {
  background: var(--tint);
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  padding: 8px;
  display: grid;
  gap: 1px;
}

.stat-card-title {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px;
}

.stat-chip {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  padding: 5px;
  display: grid;
  gap: 2px;
}

.stat-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #475569;
}

.stat-value {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
}

.stat-value.positive {
  color: #047857;
}

.stat-value.negative {
  color: #b91c1c;
}
</style>
