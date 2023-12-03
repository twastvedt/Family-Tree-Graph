<script setup lang="ts">
import FamilyTree from './components/FamilyTree.vue';
</script>

<template>
  <header>
    <h1>Wastvedt Family Tree</h1>
  </header>

  <main>
    <Suspense>
      <FamilyTree />
      <template #fallback> Loading... </template>
    </Suspense>
  </main>
</template>

<style>
body {
  min-height: 100vh;
  margin: 0;
  overflow: hidden;
}
#app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

main {
  flex-grow: 1;
  border: 1px solid black;
  margin: 4px;
}
</style>
