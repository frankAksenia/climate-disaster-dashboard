<template>
  <div id="app">
    <div class="page">
      <header class="page-header">
        <h1>Climate change dashboard</h1>
      </header>

      <section class="dashboard-grid">
        <div class="dashboard-left">
          <div class="panel">
            <div class="panel-title">Early warning</div>
            <div class="panel-body">
              <CircularInfographic />
            </div>
          </div>
          <div class="panel">
            <div class="panel-title">Relationship: imports vs disasters</div>
            <div class="panel-body">
              <DualLineChartsPanel />
            </div>
          </div>
        </div>

        <div class="dashboard-right">
          <div class="panel">
            <div class="panel-title">Trend Overview 1980-2024</div>
            <div class="panel-body">
              <LineChartPanel />
            </div>
          </div>

          <div class="panel">
            <div class="panel-title">
              Climate impact map for years 1980-2024
            </div>
            <div class="panel-body">
              <Scatterplot />
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { useStore } from "@/stores/store.js";

import Scatterplot from "./components/CountryScatterplotView.vue";
import LineChartPanel from "./components/ClimateOverviewView.vue";
import DualLineChartsPanel from "./components/LctOnDisastersView.vue";
import CircularInfographic from "./components/EarlyWarningView.vue";

const store = useStore();

onMounted(() => {
  store.loadData();
});
</script>

<style>
#app {
  background: #f6f8fb;
  min-height: 100vh;
}

.page {
  max-width: 1500px;
  margin: 0 auto;
  padding: 5px 0px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100vh;
  box-sizing: border-box;
}

.page-header h1 {
  margin: 4px 0 0;
  font-size: 22px;
  font-weight: 600;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  flex: 1;
  min-height: 0;
}

.dashboard-left {
  display: grid;
  grid-template-rows: minmax(0, 1.4fr) minmax(0, 1.55fr);
  gap: 10px;
  min-height: 0;
}

.dashboard-right {
  display: grid;
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 10px;
  min-height: 0;
}

.panel {
  background: #ffffffe6;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 4px #0f1b2c0f;
}

.panel-title {
  font-weight: 600;
  font-size: 12px;
  color: #334155;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.panel-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.panel-body > * {
  flex: 1;
  min-height: 0;
}

.chart-tooltip {
  position: absolute;
  background: #0f172a;
  color: #f8fafc;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.2);
  pointer-events: none;
  white-space: nowrap;
}

.tooltip-year {
  font-weight: 700;
  margin-bottom: 4px;
}

.tooltip-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 960px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    grid-template-rows: none;
  }
}

@media (max-height: 900px) {
  .page {
    height: auto;
    min-height: 100vh;
  }

  .dashboard-grid {
    flex: 0 0 auto;
  }

  .dashboard-left,
  .dashboard-right {
    grid-template-rows: auto;
  }
}
</style>
