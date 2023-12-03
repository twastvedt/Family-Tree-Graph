<script setup lang="ts">
import { useFamilyStore } from '../stores/familyStore';
import * as d3 from 'd3';
import settings from '@/settings';
import { onMounted, ref } from 'vue';
import { Person } from '@/models/Person';
import { Family } from '@/models/Family';

import PersonNode from './PersonNode.vue';
import FamilyNode from './FamilyNode.vue';

const map = ref<SVGSVGElement>();
const content = ref<SVGGElement>();

let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
let zoomBehavior!: d3.ZoomBehavior<SVGSVGElement, unknown>;

const family = useFamilyStore();

const width = ref(500);
const height = ref(500);

await family.ready;

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
  ...range(
    minYear - (settings.layout.maxYear - minYear),
    settings.layout.maxYear,
  ),
];

function levelClass(i: number) {
  return {
    level: true,
    'level-50': i % 50 == 0,
    'level-10': i % 10 == 0,
    'level-1': i % 10 != 0,
  };
}

const gridLabelLines = [0.25, 0.75];

onMounted(async (): Promise<void> => {
  if (!map.value || !content.value) {
    return;
  }

  map.value.style.fontSize = `${settings.layout.textSize}px`;

  svg = d3.select(map.value);

  width.value = map.value.clientWidth;
  height.value = map.value.clientHeight;

  d3.select(map.value).attr('viewBox', [
    0,
    0,
    width.value,
    height.value,
  ] as unknown as string);

  zoomBehavior = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 8])
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
    <rect class="overlay" :width="width" :height="height"></rect>

    <g ref="content" class="content">
      <g class="grid">
        <circle
          v-for="y in years"
          :key="y"
          cx="0"
          cy="0"
          :r="family.tree.scale(new Date(y, 0, 0))"
          :class="levelClass(y)"
          :id="`level-${y}`"
        />

        <g class="gridLabelLine" v-for="i in gridLabelLines" :key="i">
          <text class="label" v-for="y in years" :key="y">
            <textPath
              v-if="y % 50 == 0"
              :xlink:href="`#level-${y}`"
              :startOffset="`${i * 100}%`"
            >
              {{ y }}
            </textPath>
          </text>
        </g>

        <line
          v-for="(l, i) in family.tree.links"
          :key="i"
          :class="['link', l.type]"
        />
      </g>

      <template v-for="n in family.tree.nodeList" :key="n.handle">
        <PersonNode v-if="n instanceof Person" :person="n" />
        <FamilyNode v-else-if="n instanceof Family" :family="n" />
      </template>
    </g>
  </svg>
</template>
<style scoped>
#map {
  width: 100%;
  height: 100%;

  &:deep(*) {
    vector-effect: non-scaling-stroke;
  }
}

circle.level {
  stroke: #bbb;

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
}
</style>
