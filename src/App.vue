<script setup lang="ts">
import FamilyTree from './components/FamilyTree.vue';
</script>

<template>
  <header>
    <h1 class="title">Wastvedt Family Tree</h1>
    <div class="buttons">
      <button>Upload Gramps xml</button>
      <button>Reset Settings</button>
      <button>Export Settings</button>
      <button>Load Settings</button>
    </div>
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
  height: 100vh;
  margin: 4px;
  display: flex;
  flex-direction: column;
}

main {
  flex-grow: 1;
  border: 1px solid black;
}

header {
  display: flex;
  align-items: center;

  .title {
    flex-grow: 1;
  }
}

button {
  height: 30px;
  margin-left: 5px;
  border-radius: 5px;
  background: #fff;
  border: 1px solid #aaa;
  text-align: center;
  font-size: 16px;

  &:hover {
    background: #aaa;
  }
}
</style>
