<script setup lang="ts">
import { useFamilyStore } from '../stores/familyStore';
import * as d3 from 'd3';
import { onMounted, ref, toRef, type ComponentPublicInstance } from 'vue';
import type { DefinedPerson } from '@/models/Person';
import type { DefinedFamily } from '@/models/Family';

import PersonNode from './PersonNode.vue';
import FamilyNode from './FamilyNode.vue';
import { useSettingsStore } from '@/stores/settingsStore';

const map = ref<SVGSVGElement>();
const content = ref<SVGGElement>();
const gridLabels = ref<SVGGElement>();

let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
let zoomBehavior!: d3.ZoomBehavior<SVGSVGElement, unknown>;

const family = useFamilyStore();
const settingsStore = useSettingsStore();
const settings = toRef(settingsStore.settings);

const width = ref(500);
const height = ref(500);

if (!family.tree) {
  throw new Error('Error loading tree');
}

function* range(start: number, end: number, step = 1) {
  while (start < end) {
    yield start;
    start += step;
  }
}

const minYear = family.tree.dateRange[0].getFullYear();

// Draw grid for double the range of dates.
const years = [
  ...range(minYear - (settingsStore.maxYear - minYear), settingsStore.maxYear),
];

const labelYears = years.filter((y) => y % 50 === 0);

function levelClass(i: number) {
  return {
    level: true,
    'level-50': i % 50 == 0,
    'level-10': i % 10 == 0,
    'level-1': i % 10 != 0,
  };
}

onMounted(async (): Promise<void> => {
  if (!map.value || !content.value) {
    return;
  }

  map.value.style.fontSize = `${settings.value.layout.textSize}px`;

  svg = d3.select(map.value);

  width.value = map.value.clientWidth;
  height.value = map.value.clientHeight;

  svg.attr('viewBox', [0, 0, width.value, height.value] as unknown as string);

  zoomBehavior = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0, 8])
    .on('zoom', (e: d3.D3ZoomEvent<SVGGElement, unknown>) => {
      setZoom(e.transform);
    });

  svg
    .call(zoomBehavior)
    .call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(width.value / 2, height.value / 2),
    );
});

function rotateDate(ref: Element | ComponentPublicInstance | null, i: number) {
  if (ref instanceof SVGElement) {
    family.addRotateElement(ref, (delta) => {
      settings.value.dateLabels[i] += delta;
    });
  }
}

function setZoom(transform: d3.ZoomTransform): void {
  if (
    content.value &&
    !isNaN(transform.x) &&
    !isNaN(transform.y) &&
    isFinite(transform.k)
  ) {
    content.value.setAttribute('transform', transform as unknown as string);
  }

  // svg
  //   .selectAll('text')
  //   .style('font-size', settings.layout.textSize / transform.k + 'px');
}
</script>

<template>
  <svg
    id="map"
    ref="map"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    v-if="family.tree"
  >
    <g ref="content" class="content">
      <g class="grid">
        <circle
          v-for="y in years"
          :key="y"
          cx="0"
          cy="0"
          :r="family.tree.scale(new Date(y, 0, 1))"
          :class="levelClass(y)"
          :id="`level-${y}`"
        />

        <g ref="gridLabels">
          <g
            class="gridLabelLine"
            v-for="(angle, i) in settings.dateLabels"
            :key="i"
            :ref="(ref) => rotateDate(ref, i)"
          >
            <text class="label" v-for="y in labelYears" :key="y">
              <textPath
                :xlink:href="`#level-${y}`"
                :startOffset="`${
                  ((angle + 180) % 360 < 180 ? angle : 360 - angle) / 3.6
                }%`"
                :side="(angle + 180) % 360 < 180 ? 'left' : 'right'"
              >
                {{ y }}
              </textPath>
            </text>
          </g>
        </g>

        <line
          v-for="(l, i) in family.tree.links"
          :key="i"
          :class="['link', l.type]"
        />
      </g>

      <template v-for="n in family.tree.people" :key="n.handle">
        <PersonNode :person="n as DefinedPerson" />
      </template>

      <template v-for="n in family.tree.families" :key="n.handle">
        <FamilyNode :family="n as DefinedFamily" />
      </template>
    </g>
  </svg>
</template>
<style scoped>
#map {
  width: 100%;
  height: 100%;
}

circle.level {
  stroke: v-bind('settings.colors.grid');

  &.level-1 {
    stroke-width: 0.125px;
  }

  &.level-10 {
    stroke-width: 0.25px;
  }

  &.level-50 {
    stroke-width: 0.5px;
  }
}
.label {
  font-size: 75%;
  text-anchor: middle;
  fill: v-bind('settings.colors.gridText');
}
</style>

<style>
path,
circle,
line {
  fill: none;
  stroke-width: 1px;
  stroke: black;
  stroke-linecap: round;
}

.mainPath {
  stroke-width: 2px;
}

.pointerTarget {
  stroke: transparent;
  fill: transparent;
  cursor: move;
  stroke-width: 6px;

  &.rotate {
    cursor:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' xml:space='preserve' stroke='%23000' fill='white' stroke-width='5px' width='24' height='24' viewBox='0 0 214.367 214.367'%3E%3Cpath d='M202.403 95.22c0 46.312-33.237 85.002-77.109 93.484v25.663l-69.76-40 69.76-40v23.494c27.176-7.87 47.109-32.964 47.109-62.642 0-35.962-29.258-65.22-65.22-65.22s-65.22 29.258-65.22 65.22c0 9.686 2.068 19.001 6.148 27.688l-27.154 12.754c-5.968-12.707-8.994-26.313-8.994-40.441C11.964 42.716 54.68 0 107.184 0s95.219 42.716 95.219 95.22z'/%3E%3C/svg%3E")
        12 12,
      auto;
  }
  &.scale {
    cursor: ew-resize;
  }
}

circle.pointerTarget {
  stroke-width: 0;
}

path.pointerTarget {
  fill: none;
}

.dateDetail {
  fill: v-bind('settings.colors.gridText');
  font-size: 27%;
}

/* * {
    vector-effect: non-scaling-stroke;
  } */
</style>
@/settingsStore
