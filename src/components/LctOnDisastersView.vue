<template>
  <div class="relationship-panel">
    <div class="grid-card">
      <!-- header and info tooltip -->
      <div class="grid-card-header">
        <div class="info-wrapper">
          <button class="info-button" type="button" aria-label="Matrix info">
            i
          </button>
          <div class="info-tooltip info-tooltip--below">
            This matrix groups countries by import intensity quartile (columns)
            and disaster growth quartile (rows). Q1 is the lowest 25% of
            countries; Q4 is the highest 25%. Click a cell to filter the table
            below to countries in that bucket.
          </div>
        </div>
        <div class="top-axis-label">Import intensity quartile</div>
        <button class="pill" @click="clearSelection" :disabled="!selectedCell">
          Clear cell
        </button>
      </div>
      <!-- column and row labels -->
      <div class="matrix-header">
        <div class="corner">Disaster growth quartile</div>
        <div v-for="col in cols" :key="col" class="col-label">
          Import Q{{ col }}
        </div>
      </div>
      <!-- grid -->
      <div class="matrix-body">
        <div v-for="row in rows" :key="row" class="matrix-row">
          <div class="row-label">Disaster growth Q{{ row }}</div>
          <div
            v-for="col in cols"
            :key="`${row}-${col}`"
            class="cell"
            :class="{ active: isSelected(row, col) }"
            :style="{ backgroundColor: cellColor(row, col) }"
            @click="selectCell(row, col)"
          >
            <div class="cell-count">{{ cellCount(row, col) }}</div>
            <div class="cell-caption">countries</div>
          </div>
        </div>
      </div>
      <!-- color scale -->
      <div class="legend-bar">
        <span>Fewer</span>
        <div class="legend-gradient"></div>
        <span>More</span>
      </div>
    </div>

    <div class="table-card">
      <!-- search and table -->
      <div class="table-header">
        <input
          v-model="searchTerm"
          class="search"
          type="search"
          placeholder="Search country..."
        />
        <span class="scroll-indicator" aria-hidden="true">Scroll v</span>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Country</th>
              <th>Import intensity</th>
              <th>Disaster growth</th>
              <th>Buckets</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in visibleCountries"
              :key="row.iso3"
              :class="{ selected: isCountrySelected(row.iso3) }"
              :ref="(el) => registerRow(el, row.iso3)"
            >
              <td>{{ row.country }}</td>
              <td>{{ d3.format(".2s")(row.importIntensity) }}</td>
              <td>{{ `${d3.format("+.1f")(row.disasterGrowth)}%` }}</td>
              <td>Q{{ row.importQuartile }} / Q{{ row.growthQuartile }}</td>
            </tr>
            <tr v-if="!visibleCountries.length">
              <td colspan="4" class="empty">No countries match.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import * as d3 from "d3";
import { useStore } from "@/stores/store.js";

const store = useStore();

const cols = [1, 2, 3, 4];
const rows = [1, 2, 3, 4];

const selectedCell = ref(null);
const searchTerm = ref("");
const rowRefs = new Map();

const buckets = computed(() => store.countryMatrixBuckets);

const matrixBucketsByCell = computed(() => {
  const map = new Map();
  for (const r of rows) {
    for (const c of cols) {
      map.set(`${r}-${c}`, []);
    }
  }
  buckets.value.forEach((eachCountry) => {
    const key = `${eachCountry.growthQuartile}-${eachCountry.importQuartile}`;
    map.get(key).push(eachCountry);
  });
  return map;
});

const colorScaleForBuckets = computed(() => {
  const max = Math.max(
    1,
    ...Array.from(matrixBucketsByCell.value.values(), (arr) => arr.length)
  );
  return (count) => {
    const intensity = Math.min(1, count / max);
    return d3.interpolateRgb("#dcfce7", "#166534")(0.2 + intensity * 0.8);
  };
});

const cellCount = (row, col) => {
  return matrixBucketsByCell.value.get(`${row}-${col}`)?.length;
};

const cellColor = (row, col) => colorScaleForBuckets.value(cellCount(row, col));

const selectCell = (row, col) => {
  selectedCell.value = { growthQuartile: row, importQuartile: col };
  const key = `${row}-${col}`;
  const countries = matrixBucketsByCell.value.get(key)?.map((d) => d.iso3);
  store.setSelectedCountries(countries || [], "matrix");
};

const isSelected = (row, col) =>
  !!(
    selectedCell.value &&
    selectedCell.value.growthQuartile === row &&
    selectedCell.value.importQuartile === col
  );

const clearSelection = () => {
  selectedCell.value = null;
  store.setSelectedCountries([], "matrix");
};

// build the table
const visibleCountries = computed(() => {
  const selected = selectedCell.value;
  const search = searchTerm.value.trim().toLowerCase();
  return buckets.value.filter((d) => {
    if (
      selected &&
      (d.importQuartile !== selected.importQuartile ||
        d.growthQuartile !== selected.growthQuartile)
    ) {
      return false;
    }
    if (!search) return true;
    return d.country.toLowerCase().includes(search);
  });
});

const isCountrySelected = (iso3) => store.selectedCountries.includes(iso3);

const registerRow = (el, iso3) => {
  if (!iso3) return;
  if (el) {
    rowRefs.set(iso3, el);
  } else {
    rowRefs.delete(iso3);
  }
};

// scroll to selected countries
watch(
  () => store.selectedCountries.slice(),
  (countries) => {
    if (!countries.length) return;
    const target = rowRefs.get(countries[0]);
    if (target?.scrollIntoView) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
);
</script>

<style scoped>
.pill {
  background: #0f172a;
  color: #fff;
  border: none;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 11px;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.pill[disabled] {
  opacity: 0.4;
  cursor: default;
}

.relationship-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
}

.grid-card,
.table-card {
  background: linear-gradient(180deg, #f9fbff 0%, #f1f5f9 100%);
  border: 1px solid #d6e2f0;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 2px 4px rgba(15, 27, 44, 0.05);
}

.grid-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 0 0 55%;
  min-height: 0;
}

.grid-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.top-axis-label {
  flex: 1;
  text-align: right;
  padding-right: 12px;
  font-size: 11px;
  color: #475569;
  font-weight: 600;
}

.matrix-header {
  display: grid;
  grid-template-columns: 100px repeat(4, 1fr);
  align-items: center;
  gap: 2px;
}

.corner {
  font-size: 11px;
  color: #475569;
  font-weight: 600;
}

.col-label {
  text-align: center;
  font-size: 10px;
  color: #1f2937;
  font-weight: 600;
}

.matrix-body {
  display: grid;
  grid-template-rows: repeat(4, 1fr);
  gap: 2px;
}

.matrix-row {
  display: grid;
  grid-template-columns: 100px repeat(4, 1fr);
  gap: 2px;
  align-items: stretch;
}

.row-label {
  font-size: 10px;
  color: #1f2937;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.cell {
  border-radius: 8px;
  padding: 4px 3px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  border: 1px solid #d6e2f0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.cell:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(15, 27, 44, 0.08);
}

.cell.active {
  outline: 2px solid #0f172a;
}

.cell-count {
  font-weight: 700;
  color: #0f172a;
  font-size: 12px;
}

.cell-caption {
  font-size: 10px;
  color: #334155;
}

.legend-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #475569;
}

.legend-gradient {
  flex: 1;
  height: 10px;
  border-radius: 6px;
  background: linear-gradient(90deg, #e2e8f0 0%, #166534 100%);
}

.table-card {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.search {
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid #d6e2f0;
  font-size: 12px;
  min-width: 200px;
}

.table-wrapper {
  overflow-y: scroll;
  overflow-x: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  flex: 1 1 0;
  min-height: 0;
}

.scroll-indicator {
  background: #f8fafc;
  border: 1px solid #d6e2f0;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 10px;
  color: #475569;
  pointer-events: none;
  box-shadow: 0 1px 4px rgba(15, 27, 44, 0.06);
}

.table-wrapper::-webkit-scrollbar {
  width: 8px;
}

.table-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.table-wrapper::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.6);
  border-radius: 999px;
}

.table-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.8);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: #0f172a;
}

th,
td {
  text-align: left;
  padding: 8px 6px;
}

th {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

tbody tr:nth-child(even) {
  background: rgba(226, 232, 240, 0.35);
}

tbody tr.selected {
  background: #fcfae6;
  box-shadow: inset 0 0 0 1px #f5efc1;
}

.empty {
  text-align: center;
  color: #475569;
  padding: 12px;
}
</style>
