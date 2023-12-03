<script setup lang="ts">
import { Family } from '@/models/Family';
import Pt from '@/models/Pt';
import { useFamilyStore } from '@/stores/familyStore';
import { arc } from 'd3';
import { computed, onMounted, ref } from 'vue';

const store = useFamilyStore();

const { family } = defineProps<{
  family: Family;
}>();

const element = ref<SVGGElement>();

const centerAngle = computed(
  () =>
    family.parents[0].angle +
    (family.parents[1].angle - family.parents[0].angle) / 2,
);

const marriageLine = computed(() => {
  const scale = store.tree?.scale;

  let start = family.parents[0].angle;
  let end = family.parents[1].angle;

  //keep text upright
  if (centerAngle.value % 360 <= 180) {
    [start, end] = [end, start];
  }

  if (scale) {
    let dTheta = end - start;

    dTheta += dTheta > 180 ? -360 : dTheta < -180 ? 360 : 0;

    const largeArc = Math.abs(dTheta) > 180 ? 1 : 0,
      sweep = dTheta > 0 ? 1 : 0,
      r = scale(family.marriage);

    return (
      'M' +
      new Pt(r, (start * Math.PI) / 180).fromPolar().toString() +
      'A' +
      r +
      ',' +
      r +
      ' 0 ' +
      largeArc +
      ',' +
      sweep +
      ' ' +
      new Pt(r, (end * Math.PI) / 180).fromPolar().toString()
    );
  }
  return undefined;
});

onMounted(() => {
  family.element = element.value;
  family.rotationChildren = family.getRotationChildren();

  store.addDrag(family);
});
</script>
<template>
  <g v-if="store.tree" class="node family" :id="family.handle" ref="element">
    <path
      :class="[
        'familyArc',
        'mainPath',
        family.marriageIsEstimate ? 'estimate' : undefined,
      ]"
      :id="family.handle + '-arc'"
      :d="marriageLine"
    />

    <text class="name familyName" :dy="centerAngle % 360 < 180 ? 12 : -3">
      <textPath
        class="textPath"
        startOffset="50%"
        :xlink:href="`#${family.handle}-arc`"
      >
        {{ family.name }}
      </textPath>
    </text>
  </g>
</template>

<style scoped>
.familyName {
  text-anchor: middle;
}
</style>
