<script setup lang="ts">
import type { Person } from '@/models/Person';
import { useFamilyStore } from '@/stores/familyStore';
import { DateTime } from 'luxon';
import { computed, onMounted, ref, toRefs } from 'vue';
import settings from '../settings';

const store = useFamilyStore();

function addYears(date: Date, years: number) {
  return DateTime.fromJSDate(date).plus({ years }).toJSDate();
}

const scale = store.tree!.scale;

const props = defineProps<{
  person: Person;
}>();
const { person } = toRefs(props);

const halfFade = computed(() => settings.layout.fadeYears / 2);

const lifelineGradient = computed(
  () => person.value.deathIsEstimate && person.value.parentIn,
);

const lifelineStart = computed(() =>
  person.value.childOf
    ? person.value.birth
    : person.value.parentIn?.marriage ?? 0,
);
const lifelineEnd = computed(() => {
  if (person.value.death) {
    if (person.value.deathIsEstimate) {
      return addYears(person.value.death, halfFade.value);
    }
    return person.value.death;
  }
  return new Date(settings.layout.maxYear, 0);
});

const mainPathGradient = computed(
  () =>
    person.value.childOf ||
    (person.value.birthIsEstimate && !person.value.childOf) ||
    (person.value.deathIsEstimate && !person.value.parentIn),
);

const mainPathStart = computed(
  () =>
    person.value.childOf?.marriage ??
    addYears(
      person.value.birth,
      person.value.birthIsEstimate ? -halfFade.value : 0,
    ),
);
const mainPathEnd = computed(
  () => person.value.parentIn?.marriage ?? lifelineEnd.value,
);

const mainGradientStops = computed(() => {
  const stops: { offset: number; color: string }[] = [];
  const length = scale(mainPathEnd.value) - scale(mainPathStart.value);
  const offset = (year: Date) =>
    (scale(year) - scale(mainPathStart.value)) / length;

  if (person.value.childOf) {
    stops.push({ offset: 0, color: '#bbb' });
    if (!person.value.birthIsEstimate) {
      stops.push({
        offset: offset(person.value.birth),
        color: '#bbb',
      });
    }
    stops.push({
      offset: offset(person.value.birth),
      color: 'black',
    });
  } else if (person.value.birthIsEstimate) {
    stops.push({ offset: 0, color: 'transparent' });
    stops.push({
      offset: offset(addYears(person.value.birth, halfFade.value)),
      color: 'black',
    });
  }

  if (person.value.deathIsEstimate && !person.value.parentIn) {
    stops.push({
      offset: offset(addYears(lifelineEnd.value, -settings.layout.fadeYears)),
      color: 'black',
    });
    stops.push({
      offset: 1,
      color: 'transparent',
    });
  }

  return stops;
});
const element = ref<SVGGElement>();

const reversed = computed(() => (person.value.angle + 270) % 360 > 180);

const nameTransform = computed(() => {
  if (reversed.value) {
    return `translate(${3 - (person.value.parentOrder ?? 0) * 15}, ${
      scale(lifelineStart.value) - 7
    }) rotate(90)`;
  } else {
    return `translate(${-3 - (person.value.parentOrder ?? 0 - 1) * 15}, ${
      scale(lifelineStart.value) - 7
    }) rotate(-90)`;
  }
});

const title = computed(() => {
  let text = `${person.value.firstName}: ${
    person.value.birthIsEstimate ? '~' : ''
  }${store.formatDate(person.value.birth)} —`;

  if (person.value.death) {
    text += person.value.deathIsEstimate ? ' ~' : ' ';
    text += store.formatDate(person.value.death);
  }
  return text;
});

onMounted(() => {
  person.value.element = element.value;
  person.value.getRotationChildren();

  store.addDrag(person.value);
});
</script>
<template>
  <g
    :class="['node', 'person', person.gender]"
    :id="person.handle"
    ref="element"
    :transform="`rotate(${person.angle - 90})`"
  >
    <linearGradient
      v-if="lifelineGradient"
      :id="`${person.handle}lifeGradient`"
      :y1="scale(addYears(lifelineEnd, -settings.layout.fadeYears))"
      :y2="scale(lifelineEnd)"
      x1="0"
      x2="0"
      gradientUnits="userSpaceOnUse"
    >
      <stop offset="0%" stop-color="black" />
      <stop offset="100%" stop-color="transparent" />
    </linearGradient>

    <linearGradient
      v-if="mainPathGradient"
      :id="`${person.handle}mainGradient`"
      :y1="scale(mainPathStart)"
      :y2="scale(mainPathEnd)"
      x1="0"
      x2="0"
      gradientUnits="userSpaceOnUse"
    >
      <stop
        v-for="(stop, i) in mainGradientStops"
        :key="i"
        :offset="stop.offset"
        :stop-color="stop.color"
      />
    </linearGradient>

    <text
      :class="['name', 'personName', reversed ? 'reversed' : undefined]"
      :transform="nameTransform"
    >
      {{ person.firstName }}
    </text>
    <line
      class="life mainPath"
      x1="0"
      x2="0"
      :y1="scale(mainPathStart)"
      :y2="scale(mainPathEnd)"
      :style="{
        stroke: mainPathGradient
          ? `url(#${person.handle}mainGradient)`
          : undefined,
      }"
    />

    <line
      v-if="person.parentIn"
      class="life"
      x1="0"
      x2="0"
      :y1="scale(lifelineStart)"
      :y2="scale(lifelineEnd)"
      :style="{
        stroke: lifelineGradient
          ? `url(#${person.handle}lifeGradient)`
          : undefined,
      }"
    />

    <circle
      v-if="!person.birthIsEstimate"
      cx="0"
      :cy="scale(person.birth)"
      r="2"
      class="birth"
    />

    <line
      class="pointerTarget"
      x1="0"
      x2="0"
      :y1="scale(mainPathStart)"
      :y2="scale(person.death ?? new Date())"
    >
      <title>
        {{ title }}
      </title>
    </line>
    />
  </g>
</template>

<style scoped>
.birth {
  fill: black;
  stroke: none;
}

.personName.reversed {
  text-anchor: end;
}
</style>
