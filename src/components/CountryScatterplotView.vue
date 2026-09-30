<template>
  <div class="vis-component" ref="chart">
    <svg :width="svgWidth" :height="svgHeight">
      <g :transform="`translate(${svgPadding.left}, ${svgPadding.top})`">
        <defs>
          <!-- clip for zooming -->
          <clipPath :id="clipId" clipPathUnits="userSpaceOnUse">
            <rect :x="0" :y="0" :width="innerWidth" :height="innerHeight" />
          </clipPath>
        </defs>
        <!-- x axis -->
        <g class="axis" :transform="`translate(0, ${innerHeight})`">
          <line :x1="0" :x2="innerWidth" />
          <g v-for="tick in xTicks" :key="tick">
            <line :x1="xScale(tick)" :x2="xScale(tick)" y1="0" y2="6" />
            <text :x="xScale(tick)" y="20" text-anchor="middle">
              {{ d3.format(".1f")(tick) }}
            </text>
          </g>
          <text
            class="axis-label x-label"
            :x="innerWidth - 95"
            y="25"
            text-anchor="middle"
          >
            Avg. Temp Change (vs {{ baselineLabel }})
          </text>
        </g>

        <!-- y axis -->
        <g class="axis">
          <line :y2="innerHeight" />
          <g v-for="tick in yTicks" :key="tick">
            <line :y1="yScale(tick)" :y2="yScale(tick)" x1="-6" x2="0" />
            <text x="-10" :y="yScale(tick) + 5" text-anchor="end">
              {{ d3.format(".1f")(tick) }}
            </text>
          </g>
          <text
            class="axis-label y-label"
            :x="-svgPadding.left - 20"
            :y="-50"
            text-anchor="middle"
            transform="rotate(-90)"
          >
            Avg. Climate Disasters (total/yr)
          </text>
        </g>

        <g
          v-if="legendData.length"
          class="legend"
          :transform="`translate(${innerWidth - 120}, 10)`"
        >
          <g
            v-for="(item, idx) in legendData"
            :key="item.continent"
            :transform="`translate(0, ${idx * 14})`"
          >
            <circle :cx="0" :cy="0" r="4" :fill="item.color" />
            <text x="8" y="4">{{ item.continent }}</text>
          </g>
        </g>

        <!-- dots -->
        <g class="dots" :clip-path="`url(#${clipId})`">
          <circle
            v-for="(datapoint, idx) in buildScatterData"
            :key="idx"
            :class="[
              'dot',
              {
                selected: isStateSelected(datapoint.iso3),
                faded:
                  store.selectedCountries.length > 0 &&
                  !isStateSelected(datapoint.iso3),
              },
            ]"
            :cx="xScale(datapoint.temperature)"
            :cy="yScale(datapoint.disasters)"
            :r="radiusScaleByArea(datapoint.area)"
            :fill="continentColorScale(datapoint.continent)"
          />
        </g>

        <!-- brushing -->
        <g ref="brushLayer"></g>
      </g>
    </svg>
    <!-- tooltip -->
    <div
      v-if="tooltip.visible"
      class="chart-tooltip"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
    >
      <div class="tooltip-year">{{ tooltip.title }}</div>
      <div v-for="item in tooltip.items" :key="item.label" class="tooltip-row">
        <span class="tooltip-label">{{ item.label }}:</span>
        <span>{{ item.value }}</span>
      </div>
    </div>
    <!-- footer for zoom and info -->
    <div class="chart-footer" ref="chartFooter">
      <div class="baseline-info">
        <div class="info-wrapper">
          <button class="info-button" type="button" aria-label="Baseline info">
            i
          </button>
          <div class="info-tooltip info-tooltip--above">
            Baseline used: {{ baselineLabel }} (WMO climate normal). Analysis is
            focused on 1980-2024, and 30-year baseline is independent of the
            analysis window. Dot size scales with land area (km2); colors show
            continent.
          </div>
        </div>
      </div>
      <div class="chart-controls">
        <button
          class="control-button"
          type="button"
          @click="resetZoom"
          :disabled="!isZoomed"
        >
          Reset zoom
        </button>
        <span class="control-hint">Scroll to zoom, Shift+drag to pan</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import * as d3 from "d3";
import { useStore } from "@/stores/store.js";
const store = useStore();

const svgPadding = { top: 20, right: 20, bottom: 55, left: 70 };

const svgWidth = ref(500);
const svgHeight = ref(500);
const chart = ref(null);
const brushLayer = ref(null);
const tooltip = ref({ visible: false, x: 0, y: 0, title: "", items: [] });
const zoomTransform = ref(d3.zoomIdentity);
const clipId = `scatter-clip-${Math.random().toString(36).slice(2, 9)}`;
const chartFooter = ref(null);
let brushInstance = null;
let zoomInstance = null;
let resizeObserver = null;

const innerWidth = computed(
  () => svgWidth.value - svgPadding.left - svgPadding.right
);
const innerHeight = computed(
  () => svgHeight.value - svgPadding.top - svgPadding.bottom
);

const paddedDomain = (values) => {
  const filtered = values.filter((v) => Number.isFinite(v));
  const [min, max] = d3.extent(filtered);
  const range = max - min;
  return [min - range * 0.05, max + range * 0.05];
};

const xDomain = computed(() =>
  paddedDomain(buildScatterData.value.map((d) => d.temperature))
);

const yDomain = computed(() =>
  paddedDomain(buildScatterData.value.map((d) => d.disasters))
);

const baseXScale = computed(() =>
  d3.scaleLinear().range([0, innerWidth.value]).domain(xDomain.value)
);

const baseYScale = computed(() =>
  d3.scaleLinear().range([innerHeight.value, 0]).domain(yDomain.value)
);

const xScale = computed(() => zoomTransform.value.rescaleX(baseXScale.value));

const yScale = computed(() => zoomTransform.value.rescaleY(baseYScale.value));

const xTicks = computed(() => xScale.value.ticks(5));

const yTicks = computed(() => yScale.value.ticks(5));

const isZoomed = computed(
  () =>
    zoomTransform.value.k !== 1 ||
    zoomTransform.value.x !== 0 ||
    zoomTransform.value.y !== 0
);

const buildScatterData = computed(() => {
  const disasters = store.getDisastersAveragePerCountry;
  const temperatures = store.getTemperatureChangeAveragePerCountry;
  return disasters
    .map((d) => {
      const temp = temperatures.find((t) => t.iso3 === d.iso3);
      if (!temp) return null;
      return {
        country: d.country,
        iso3: d.iso3,
        disasters: d.average,
        temperature: temp.average,
        population: temp.population,
        area: temp.area,
        continent: temp.continent,
      };
    })
    .filter(Boolean);
});

const baselineLabel = computed(() => {
  return `${store.getTemperatureBaseline?.start}-${store.getTemperatureBaseline?.end}`;
});

const radiusScaleByArea = computed(() => {
  const values = buildScatterData.value.map((d) => d.area);
  const [min, max] = d3.extent(values);
  return d3.scaleSqrt().domain([min, max]).range([3, 10]);
});

const continentColorScale = computed(() => {
  const continents = [
    ...new Set(buildScatterData.value.map((d) => d.continent)),
  ].sort(d3.ascending);
  return d3.scaleOrdinal().domain(continents).range(d3.schemeTableau10);
});

const legendData = computed(() => {
  const scale = continentColorScale.value;
  return scale.domain().map((continent) => ({
    continent,
    color: scale(continent),
  }));
});

const isStateSelected = (iso3) => store.selectedCountries.includes(iso3);

const showTooltip = (d, event) => {
  const rect = chart.value.getBoundingClientRect();
  tooltip.value = {
    visible: true,
    x: event.clientX - rect.left + 10,
    y: event.clientY - rect.top - 80,
    title: d.country,
    items: [
      {
        label: `Temp change`,
        value: `${d3.format(".2f")(d.temperature)} C`,
      },
      {
        label: "Avg disasters",
        value: d3.format(".2f")(d.disasters),
      },
      {
        label: "Area",
        value: `${d3.format(",.0f")(d.area)} km2`,
      },
    ],
  };
};

const hideTooltip = () => {
  tooltip.value.visible = false;
  setOverlayCursor("default");
};

const setOverlayCursor = (cursor) => {
  d3.select(brushLayer.value).select(".overlay").style("cursor", cursor);
};

// circle listeners under the brush overlay
const pointIndex = computed(() =>
  d3
    .quadtree()
    .x((d) => xScale.value(d.temperature))
    .y((d) => yScale.value(d.disasters))
    .addAll(buildScatterData.value)
);

const hoverOverDot = (event) => {
  if (event.shiftKey) {
    tooltip.value.visible = false;
    setOverlayCursor("grab");
    return;
  }
  const [mx, my] = d3.pointer(event);
  const nearest = pointIndex.value.find(mx, my, 8);

  if (nearest) {
    showTooltip(nearest, event);
    setOverlayCursor("pointer");
  } else {
    hideTooltip();
    setOverlayCursor("default");
  }
};

const handleDotClick = (event) => {
  if (event.defaultPrevented || event.shiftKey) return;
  const [mx, my] = d3.pointer(event);
  const nearest = pointIndex.value.find(mx, my, 10);
  store.setSelectedCountries([nearest.iso3], "scatter");
};

const handleBrush = (event) => {
  const selection = event.selection;

  if (!selection) {
    store.setSelectedCountries([], "brush");
    return;
  }

  const [[x0, y0], [x1, y1]] = selection;
  const [xMin, xMax] = x0 <= x1 ? [x0, x1] : [x1, x0];
  const [yMin, yMax] = y0 <= y1 ? [y0, y1] : [y1, y0];

  if (event.type === "end" && Math.abs(x1 - x0) < 1 && Math.abs(y1 - y0) < 1) {
    clearBrush();
    store.setSelectedCountries([]);
    return;
  }

  const selected = buildScatterData.value
    .filter((d) => {
      const x = xScale.value(d.temperature);
      const y = yScale.value(d.disasters);
      return xMin <= x && x <= xMax && yMin <= y && y <= yMax;
    })
    .map((d) => d.iso3);

  store.setSelectedCountries(selected);
};

const clearBrush = () => {
  d3.select(brushLayer.value).call(brushInstance.move, null);
};

// bind hover/click handlers to the brush overlay that sits above the dots
const attachOverlayHandlers = (overlay) => {
  if (!overlay || overlay.empty()) return;
  overlay
    .attr("cursor", "default")
    .on("mousemove.tooltip", hoverOverDot)
    .on("mouseleave.tooltip", hideTooltip)
    .on("click.select", handleDotClick);
};

const setupZoom = (overlay) => {
  if (!zoomInstance) {
    zoomInstance = d3
      .zoom()
      .scaleExtent([1, 8])
      .filter((event) => {
        if (event.type === "wheel") return true;
        if (event.type === "mousedown")
          return event.shiftKey && event.button === 0;
        return false;
      })
      .on("zoom", (event) => {
        zoomTransform.value = event.transform;
        tooltip.value.visible = false;
      });
  }

  zoomInstance
    .extent([
      [0, 0],
      [innerWidth.value, innerHeight.value],
    ])
    .translateExtent([
      [0, 0],
      [innerWidth.value, innerHeight.value],
    ]);

  overlay.call(zoomInstance);
  overlay.call(zoomInstance.transform, zoomTransform.value);
};

const resetZoom = () => {
  if (!brushLayer.value || !zoomInstance) {
    zoomTransform.value = d3.zoomIdentity;
    return;
  }
  const overlay = d3.select(brushLayer.value).select(".overlay");
  if (overlay.empty()) {
    zoomTransform.value = d3.zoomIdentity;
    return;
  }
  overlay.call(zoomInstance.transform, d3.zoomIdentity);
};

const setupBrush = () => {
  const brushSelection = d3.select(brushLayer.value);

  brushInstance = d3
    .brush()
    .filter((event) => {
      if (event.type === "touchstart") return true;
      return !event.shiftKey && event.button === 0;
    })
    .extent([
      [0, 0],
      [innerWidth.value, innerHeight.value],
    ])
    .on("brush end", handleBrush);

  brushSelection.call(brushInstance);

  const overlay = brushSelection.select(".overlay");
  attachOverlayHandlers(overlay);
  setupZoom(overlay);
};

const updateDimensions = () => {
  if (!chart.value) return;

  const width = chart.value.clientWidth;
  const footerHeight = chartFooter.value?.clientHeight || 0;
  const height = (chart.value.clientHeight || width) - footerHeight;
  svgWidth.value = width;
  svgHeight.value = Math.min(width, Math.max(0, height));

  if (brushInstance) {
    brushInstance.extent([
      [0, 0],
      [innerWidth.value, innerHeight.value],
    ]);
    const brushSelection = d3.select(brushLayer.value);
    brushSelection.call(brushInstance);
    const overlay = brushSelection.select(".overlay");
    attachOverlayHandlers(overlay);
    setupZoom(overlay);
  }
};

onMounted(() => {
  updateDimensions();
  if (chart.value) {
    resizeObserver = new ResizeObserver(() => updateDimensions());
    resizeObserver.observe(chart.value);
  }
  setupBrush();
});

onUnmounted(() => {
  if (resizeObserver && chart.value) resizeObserver.unobserve(chart.value);
  if (resizeObserver) resizeObserver.disconnect();
});

watch(buildScatterData, () => {
  if (!brushLayer.value || !brushInstance) return;
  const selection = d3.brushSelection(brushLayer.value);
  if (selection) handleBrush({ selection, type: "brush" });
});

watch(
  () => store.selectedCountries.length,
  (len) => {
    if (len === 0) clearBrush();
  }
);
</script>

<style scoped>
.vis-component {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.axis line {
  stroke: #555;
  stroke-width: 1;
}

.axis text {
  font-size: 12px;
  fill: #333;
}

.axis-label {
  font-size: 12px;
  fill: #333;
}

.x-label {
  dominant-baseline: hanging;
}

.y-label {
  dominant-baseline: middle;
}

.dots .dot {
  stroke: #fff;
  stroke-width: 1.5;
  cursor: pointer;
}

.dots .dot.selected {
  stroke: #0f3057;
  stroke-width: 1.5;
}

.dots .dot.faded {
  opacity: 0.25;
}

.legend text {
  font-size: 11px;
  fill: #333;
}

.legend circle {
  stroke: #fff;
  stroke-width: 0.5;
}

.tooltip-label {
  font-weight: 600;
}

.chart-footer {
  margin-top: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.baseline-info {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #4a4a4a;
  position: relative;
  z-index: 2;
}

.chart-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #64748b;
}

.control-button {
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.control-button:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.control-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.control-hint {
  color: #64748b;
}
</style>
