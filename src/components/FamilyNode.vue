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
const lineTarget = ref<SVGElement>();
const centerTarget = ref<SVGElement>();

const startAngle = computed(() => {
  if (family.value.parents.length == 2) {
    return family.value.parents[0].angle;
  } else {
    const childAngles = family.value.children.map((p) => p.angle);
    const parentAngles = family.value.parents.map((p) => p.angle);

    let start = Math.min(...childAngles);

    const minParent = Math.min(...parentAngles);

    if (minParent <= start) {
      start = minParent;
    } else {
      // TODO: setting
      start -= 5;
    }

    return start;
  }
});

const endAngle = computed(() => {
  if (family.value.parents.length == 2) {
    return family.value.parents[1].angle;
  } else {
    const childAngles = family.value.children.map((p) => p.angle);
    const parentAngles = family.value.parents.map((p) => p.angle);

    let end = Math.max(...childAngles);

    const maxParent = Math.max(...parentAngles);

    if (maxParent >= end) {
      end = maxParent;
    } else {
      end += 5;
    }

    return end;
  }
});

const centerAngle = computed(
  () => startAngle.value + (endAngle.value - startAngle.value) / 2,
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
  let start = startAngle.value;
  let end = endAngle.value;

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

const title = computed(() =>
  family.value.name + ': ' + family.value.marriage.isEstimate
    ? '~'
    : '' + familyStore.formatDate(family.value.marriage.date),
);

function clearAngle(e: MouseEvent) {
  if (e.altKey) {
    for (const node of family.value.rotationChildren) {
      delete settings.value.overrides.people[node.handle]?.angle;
    }
    e.stopPropagation();
    location.reload();
  }
}

function clearDate(e: MouseEvent) {
  if (e.altKey) {
    delete settings.value.overrides.families[family.value.handle]?.year;
    e.stopPropagation();
    location.reload();
  }
}

onMounted(() => {
  family.value.setRotationChildren();

  if (!lineTarget.value || !centerTarget.value) {
    console.error(`No elements on ${title.value}.`);
    return;
  }

  familyStore.addRotateElement(
    lineTarget.value,
    (delta) => {
      for (const child of family.value.rotationChildren) {
        child.angle += delta;
      }
    },
    () => {
      for (const node of family.value.rotationChildren) {
        settings.value.overrides.people[node.handle] = Object.assign(
          settings.value.overrides.people[node.handle] ?? {},
          {
            angle: node.angle,
          },
        );
      }
    },
  );

  if (family.value.marriage.isEstimate) {
    familyStore.addScaleElement(
      centerTarget.value,
      () => family.value.marriage,
      () => {
        settings.value.overrides.families[family.value.handle] = Object.assign(
          settings.value.overrides.families[family.value.handle] ?? {},
          {
            year: family.value.marriage.date.getUTCFullYear(),
          },
        );
      },
    );
  }
});
</script>
<template>
  <g class="node family" :id="family.handle" ref="element">
    <text
      v-if="!family.marriage.isEstimate && dateAngle != undefined"
      :dy="reversed ? -3.5 : 5.6"
    >
      <textPath
        :xlink:href="`#level-${family.marriage.date.getUTCFullYear()}`"
        :class="['dateDetail']"
        :startOffset="`${(reversed ? 360 - dateAngle : dateAngle) / 3.6}%`"
        :side="reversed ? 'right' : 'left'"
      >
        {{ family.marriage.date.getUTCFullYear() }}
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

    <path
      class="pointerTarget rotate"
      :d="marriageLinePath"
      ref="lineTarget"
      @click="clearAngle"
    >
      <title>
        {{ title }}
      </title>
    </path>

    <circle
      class="pointerTarget scale"
      ref="centerTarget"
      :cx="Math.cos((centerAngle * Math.PI) / 180) * radius"
      :cy="Math.sin((centerAngle * Math.PI) / 180) * radius"
      r="6"
      @click="clearDate"
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
