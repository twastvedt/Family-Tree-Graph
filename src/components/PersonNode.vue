<script setup lang="ts">
import type { Person } from '@/models/Person';
import { useFamilyStore } from '@/stores/familyStore';
import { DateTime } from 'luxon';
import { computed, onMounted, ref, toRefs } from 'vue';
import settings from '../settings';

const store = useFamilyStore();

const scale = store.tree!.scale;

const props = defineProps<{
  person: Person;
}>();
const { person } = toRefs(props);

const lifelineStart = computed(
  () => person.value.birth ?? person.value.death ?? new Date(),
);
const lifelineEnd = computed(() => {
  if (person.value.death) {
    if (person.value.deathIsEstimate) {
      return DateTime.fromJSDate(person.value.death)
        .plus({ years: settings.layout.fadeYears / 2 })
        .toJSDate();
    }
    return person.value.death;
  }
  return new Date();
});

const element = ref<SVGGElement>();

const reversed = computed(() => (person.value.angle + 270) % 360 > 180);

const hasGradient = computed(
  () => person.value.deathIsEstimate && person.value.death,
);

const transform = computed(() => {
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
  }${store.formatDate(lifelineStart.value)} —`;

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

// TODO(?): add person line for people with no parent
// people.filter(function (d) { return !d.hasOwnProperty('childOf'); })
</script>
<template>
  <g
    :class="['node', 'person', person.gender]"
    :id="person.handle"
    ref="element"
    :transform="`rotate(${person.angle - 90})`"
  >
    <linearGradient
      v-if="hasGradient"
      :id="`${person.handle}Gradient`"
      :y1="
        scale(
          DateTime.fromJSDate(lifelineEnd)
            .minus({ years: settings.layout.fadeYears })
            .toJSDate(),
        )
      "
      :y2="scale(lifelineEnd)"
      x1="0"
      x2="0"
      gradientUnits="userSpaceOnUse"
    >
      <stop offset="0%" stop-color="black" />
      <stop offset="100%" stop-color="transparent" />
    </linearGradient>

    <text
      :class="['name', 'personName', reversed ? 'reversed' : undefined]"
      :transform="transform"
    >
      {{ person.firstName }}
    </text>
    <line
      v-if="person.childOf"
      classe="link mainPath"
      x1="0"
      x2="0"
      :y1="scale(person.childOf.marriage)"
      :y2="scale(lifelineStart)"
    />
    <line
      v-if="person.parentIn"
      class="life mainPath"
      x1="0"
      x2="0"
      :y1="scale(lifelineStart)"
      :y2="scale(person.parentIn.marriage)"
    />

    <line
      class="life"
      x1="0"
      x2="0"
      :y1="scale(lifelineStart)"
      :y2="scale(lifelineEnd)"
      :style="{
        stroke: hasGradient ? `url(#${person.handle}Gradient)` : undefined,
      }"
    />

    <circle
      v-if="!person.birthIsEstimate"
      cx="0"
      :cy="scale(lifelineStart)"
      r="2"
      class="birth"
    />

    <line
      class="pointerTarget"
      x1="0"
      x2="0"
      :y1="scale(person.childOf?.marriage ?? lifelineStart)"
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
