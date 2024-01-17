<script setup lang="ts">
import type { DefinedPerson } from '@/models/Person';
import { useFamilyStore } from '@/stores/familyStore';
import { useSettingsStore, type PersonOverride } from '@/stores/settingsStore';
import { DateTime } from 'luxon';
import { computed, onMounted, ref, toRef, toRefs } from 'vue';

const store = useFamilyStore();
const settingsStore = useSettingsStore();
const settings = toRef(settingsStore.settings);

function addYears(date: Date, years: number) {
  return DateTime.fromJSDate(date).plus({ years }).toJSDate();
}

const scale = store.tree!.scale.bind(store.tree);

const props = defineProps<{
  person: DefinedPerson;
}>();
const { person } = toRefs(props);

const halfFade = computed(() => settings.value.layout.fadeYears / 2);

const lifelineGradient = computed(
  () => person.value.death?.isEstimate && person.value.parentIn,
);

const lifelineStart = computed(() =>
  person.value.childOf
    ? person.value.birth.date
    : person.value.parentIn?.marriage?.date ?? new Date(),
);
const lifelineEnd = computed(() => {
  if (person.value.death) {
    if (person.value.death.isEstimate) {
      return addYears(person.value.death.date, halfFade.value);
    }
    return person.value.death.date;
  }
  return settingsStore.maxDate;
});

const mainPathGradient = computed(
  () => person.value.childOf || person.value.birth.isEstimate,
);

const mainPathStart = computed(
  () =>
    person.value.childOf?.marriage?.date ??
    addYears(
      person.value.birth.date,
      person.value.birth.isEstimate ? -halfFade.value : 0,
    ),
);
const mainPathEnd = computed(
  () => person.value.parentIn?.marriage?.date ?? lifelineEnd.value,
);

const mainGradientStops = computed(() => {
  const stops: { offset: number; color: string }[] = [];
  const length = scale(mainPathEnd.value) - scale(mainPathStart.value);
  const offset = (year: Date) =>
    (scale(year) - scale(mainPathStart.value)) / length;

  if (person.value.childOf) {
    stops.push({ offset: 0, color: settings.value.colors.familyConnector });
    if (!person.value.birth.isEstimate) {
      stops.push({
        offset: offset(person.value.birth.date),
        color: settings.value.colors.familyConnector,
      });
    }
    stops.push({
      offset: offset(person.value.birth.date),
      color: 'black',
    });
  } else if (person.value.birth.isEstimate) {
    stops.push({ offset: 0, color: 'transparent' });
    stops.push({
      offset: offset(addYears(person.value.birth.date, halfFade.value)),
      color: 'black',
    });
  }

  if (
    (!person.value.death || person.value.death.isEstimate) &&
    !person.value.parentIn
  ) {
    stops.push({
      offset: offset(
        addYears(lifelineEnd.value, -settings.value.layout.fadeYears),
      ),
      color: 'black',
    });
    stops.push({
      offset: 1,
      color: 'transparent',
    });
  }

  return stops;
});
const rotateTarget = ref<SVGGElement>();
const birthTarget = ref<SVGGElement>();
const deathTarget = ref<SVGGElement>();

const reversed = computed(() => (person.value.angle + 270) % 360 > 180);
const reversed90 = computed(() => (person.value.angle + 180) % 360 < 180);

const nameTransform = computed(() => {
  if (reversed.value) {
    return `translate(${person.value.parentOrder ? -12 : 3}, ${
      scale(lifelineStart.value) - 7
    }) rotate(90)`;
  } else {
    return `translate(${person.value.parentOrder ? -3 : 12}, ${
      scale(lifelineStart.value) - 7
    }) rotate(-90)`;
  }
});

const dateFlipped = computed(
  () => Boolean(person.value.parentOrder) === reversed90.value,
);

const title = computed(() => {
  let text = `${person.value.firstName}: ${
    person.value.birth.isEstimate ? '~' : ''
  }${store.formatDate(person.value.birth.date)} —`;

  if (person.value.death) {
    text += person.value.death.isEstimate ? ' ~' : ' ';
    text += store.formatDate(person.value.death.date);
  }
  return text;
});

function clearAngle(e: MouseEvent) {
  if (e.altKey) {
    if (e.shiftKey) {
      delete settings.value.overrides.people[person.value.handle]?.angle;
    } else {
      for (const node of person.value.rotationChildren) {
        delete settings.value.overrides.people[node.handle]?.angle;
      }
    }
    e.stopPropagation();
    location.reload();
  }
}

function clearDate(e: MouseEvent, remove: (override: PersonOverride) => void) {
  if (e.altKey) {
    const override = settings.value.overrides.people[person.value.handle];
    if (override) {
      remove(override);
    }
    e.stopPropagation();
    location.reload();
  }
}

onMounted(() => {
  person.value.setRotationChildren();

  if (!rotateTarget.value) {
    console.error(`No element on ${title.value}.`);
    return;
  }

  store.addRotateElement(
    rotateTarget.value,
    (delta, event) => {
      if (event.shiftKey) {
        person.value.angle += delta;
      } else {
        for (const child of person.value.rotationChildren) {
          child.angle += delta;
        }
      }
    },
    (event) => {
      const modify = event.shiftKey
        ? [person.value]
        : person.value.rotationChildren;

      for (const node of modify) {
        settings.value.overrides.people[node.handle] = Object.assign(
          settings.value.overrides.people[node.handle] ?? {},
          {
            angle: node.angle,
          },
        );
      }
    },
  );

  if (birthTarget.value) {
    store.addScaleElement(
      birthTarget.value,
      () => person.value.birth,
      () => {
        settings.value.overrides.people[person.value.handle] = Object.assign(
          settings.value.overrides.people[person.value.handle] ?? {},
          {
            birth: person.value.birth.date.getFullYear(),
          },
        );
      },
    );
  }

  if (deathTarget.value && person.value.death) {
    store.addScaleElement(
      deathTarget.value,
      () => person.value.death!,
      () => {
        settings.value.overrides.people[person.value.handle] = Object.assign(
          settings.value.overrides.people[person.value.handle] ?? {},
          {
            death: person.value.death?.date.getFullYear(),
          },
        );
      },
    );
  }
});
</script>
<template>
  <text
    :dx="dateFlipped ? -3.5 : 3.5"
    dy="-0.4"
    v-if="!person.birth.isEstimate"
  >
    <textPath
      :xlink:href="`#level-${person.birth.date.getFullYear()}`"
      :class="['dateDetail', dateFlipped ? 'reversed' : undefined]"
      :startOffset="`${
        (reversed90 ? person.angle : 360 - person.angle) / 3.6
      }%`"
      :side="reversed90 ? 'left' : 'right'"
    >
      {{ person.birth.date.getFullYear() }}
    </textPath>
  </text>
  <text
    :dx="dateFlipped ? -2.5 : 2.5"
    dy="-0.4"
    v-if="person.death?.isEstimate === false"
  >
    <textPath
      :xlink:href="`#level-${person.death.date.getFullYear()}`"
      :class="['dateDetail', dateFlipped ? 'reversed' : undefined]"
      :startOffset="`${
        (reversed90 ? person.angle : 360 - person.angle) / 3.6
      }%`"
      :side="reversed90 ? 'left' : 'right'"
    >
      {{ person.death.date.getFullYear() }}
    </textPath>
  </text>

  <g
    :class="['node', 'person', person.gender]"
    :id="person.handle"
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
      v-if="!person.birth.isEstimate"
      cx="0"
      :cy="scale(person.birth.date)"
      r="2"
      class="birth"
    />

    <line
      class="pointerTarget rotate"
      ref="rotateTarget"
      x1="0"
      x2="0"
      :y1="scale(mainPathStart)"
      :y2="scale(person.death?.date ?? new Date())"
      @click="clearAngle"
    >
      <title>
        {{ title }}
      </title>
    </line>
    />

    <line
      v-if="person.birth.isEstimate"
      class="pointerTarget scale"
      ref="birthTarget"
      x1="0"
      x2="0"
      :y1="scale(mainPathStart)"
      :y2="scale(addYears(person.birth.date, halfFade))"
      @click="(e) => clearDate(e, (o) => delete o.birth)"
    >
      <title>~{{ store.formatDate(person.birth.date) }}</title>
    </line>

    <line
      v-if="person.death?.isEstimate"
      class="pointerTarget scale"
      ref="deathTarget"
      x1="0"
      x2="0"
      :y1="scale(addYears(person.death.date, -halfFade))"
      :y2="scale(addYears(person.death.date, halfFade))"
      @click="(e) => clearDate(e, (o) => delete o.death)"
    >
      <title>~{{ store.formatDate(person.death.date) }}</title>
    </line>
  </g>
</template>

<style scoped>
.birth {
  fill: black;
  stroke: none;
}

.reversed {
  text-anchor: end;
}

.dateDetail {
  dominant-baseline: top;
}
</style>
