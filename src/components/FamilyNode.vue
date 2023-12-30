<script setup lang="ts">
import { type DefinedFamily } from '@/models/Family';
import Pt from '@/models/Pt';
import { useFamilyStore } from '@/stores/familyStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { computed, onMounted, ref, toRef, toRefs } from 'vue';

const familyStore = useFamilyStore();
const settingsStore = useSettingsStore();
const settings = toRef(settingsStore.settings);
const scale = familyStore.tree!.scale.bind(familyStore.tree);

const props = defineProps<{
  family: DefinedFamily;
}>();
const { family } = toRefs(props);

const element = ref<SVGGElement>();
const marriageLine = ref<SVGElement>();

const centerAngle = computed(
  () =>
    family.value.parents[0].angle +
    (family.value.parents[1].angle - family.value.parents[0].angle) / 2,
);

const reversed = computed(() => centerAngle.value % 360 <= 180);
const radius = computed(() => scale(family.value.marriage.date));

const dateAngle = computed(() => {
  // Arc width of a 4-digit date at family's radius.
  const width = (15 * 180) / (radius.value * Math.PI);
  const angles = family.value.parents
    .map((p) => p.angle)
    .concat(family.value.children.map((c) => c.angle))
    .sort((a, b) => a - b);

  // Get all segments between people, padding with half the arc width.
  const gaps = angles
    .slice(1)
    .map((a, i) => [angles[i] + width / 2, a - width / 2] as [number, number])
    // Only keep those which are bigger than the arc width.
    .filter((g) => g[1] >= g[0]);

  // Find the angle within each segment closest to the center.
  const closests = gaps.map((g) =>
    Math.min(Math.max(g[0], centerAngle.value), g[1]),
  );
  // Sort by proximity to the center.
  return closests.sort(
    (a, b) => Math.abs(centerAngle.value - a) - Math.abs(centerAngle.value - b),
  )[0];
});

const marriageLinePath = computed(() => {
  let start = family.value.parents[0].angle;
  let end = family.value.parents[1].angle;

  //keep text upright
  if (reversed.value) {
    [start, end] = [end, start];
  }

  let dTheta = end - start;

  dTheta += dTheta > 180 ? -360 : dTheta < -180 ? 360 : 0;

  const largeArc = Math.abs(dTheta) > 180 ? 1 : 0,
    sweep = dTheta > 0 ? 1 : 0;

  return (
    'M' +
    new Pt(radius.value, (start * Math.PI) / 180).fromPolar().toString() +
    `A${radius.value},${radius.value} 0 ${largeArc},${sweep} ` +
    new Pt(radius.value, (end * Math.PI) / 180).fromPolar().toString()
  );
});

onMounted(() => {
  family.value.element = element.value;
  family.value.setRotationChildren();

  familyStore.addRotateNode(family.value);

  if (family.value.marriage.isEstimate) {
    familyStore.addScaleElement(
      marriageLine.value!,
      (year) => (family.value.marriage.date = new Date(year, 0, 0)),
      () => {
        settings.value.overrides.families[family.value.handle] = Object.assign(
          settings.value.overrides.families[family.value.handle] ?? {},
          {
            year: family.value.marriage.date.getFullYear(),
          },
        );
      },
    );
  }
});
</script>
<template>
  <g
    v-if="familyStore.tree"
    class="node family"
    :id="family.handle"
    ref="element"
  >
    <text
      v-if="!family.marriage.isEstimate && dateAngle != undefined"
      :dy="reversed ? -3.5 : 5.6"
    >
      <textPath
        :xlink:href="`#level-${family.marriage.date.getFullYear()}`"
        :class="['dateDetail']"
        :startOffset="`${(reversed ? 360 - dateAngle : dateAngle) / 3.6}%`"
        :side="reversed ? 'right' : 'left'"
      >
        {{ family.marriage.date.getFullYear() }}
      </textPath>
    </text>
    <path
      :class="[
        'familyArc',
        'mainPath',
        family.marriage.isEstimate ? 'estimate' : undefined,
      ]"
      :id="family.handle + '-arc'"
      :d="marriageLinePath"
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

    <path class="pointerTarget" :d="marriageLinePath" ref="marriageLine">
      <title>
        {{ family.name }}: {{ family.marriage.isEstimate ? '~' : ''
        }}{{ familyStore.formatDate(family.marriage.date) }}
      </title>
    </path>
    />
  </g>
</template>

<style scoped>
.familyName {
  text-anchor: middle;
}

.estimate {
  stroke: v-bind('settings.colors.estimate');
}

.dateDetail {
  text-anchor: middle;
}
</style>
