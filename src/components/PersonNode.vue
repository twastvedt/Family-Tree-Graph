<script setup lang="ts">
import type { Person } from '@/models/Person';
import { useFamilyStore } from '@/stores/familyStore';
import { computed, onMounted, ref } from 'vue';

const store = useFamilyStore();

const scale = store.tree!.scale;

const { person } = defineProps<{
  person: Person;
}>();

const birth = computed(() => person.birth ?? person.death ?? new Date());

const element = ref<SVGGElement>();

const reversed = computed(() => (person.angle + 270) % 360 > 180);

const transform = computed(() => {
  if (reversed.value) {
    return `translate(${3 - (person.parentOrder ?? 0) * 15}, ${
      scale(birth.value) - 7
    }) rotate(90)`;
  } else {
    return `translate(${-3 - (person.parentOrder ?? 0 - 1) * 15}, ${
      scale(birth.value) - 7
    }) rotate(-90)`;
  }
});

onMounted(() => {
  person.element = element.value;
  person.rotationChildren = person.getRotationChildren();

  store.addDrag(person);
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
      :y2="scale(birth)"
    />
    <line
      v-if="person.parentIn"
      class="life mainPath"
      x1="0"
      x2="0"
      :y1="scale(birth)"
      :y2="scale(person.parentIn.marriage)"
    />

    <line
      class="life"
      x1="0"
      x2="0"
      :y1="scale(birth)"
      :y2="scale(person.death ? person.death : new Date())"
    />

    <circle
      v-if="!person.birthIsEstimate"
      cx="0"
      :cy="scale(birth)"
      r="2"
      class="birth"
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
