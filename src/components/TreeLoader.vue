<script setup lang="ts">
import { useFamilyStore } from '@/stores/familyStore';
import FamilyTree from './FamilyTree.vue';

const family = useFamilyStore();

await family.ready;
</script>
<template>
  <FamilyTree v-if="family.tree" />
  <template v-else> Upload Gramps xml file. </template>
</template>
