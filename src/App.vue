<script setup lang="ts">
import { ref } from 'vue';
import { useSettingsStore } from './stores/settingsStore';
import TreeLoader from './components/TreeLoader.vue';
import { useFamilyStore } from './stores/familyStore';

const settingsStore = useSettingsStore();
const familyStore = useFamilyStore();
const settingsInput = ref<HTMLInputElement>();
const xmlInput = ref<HTMLInputElement>();

function exportSettings() {
  var saver = document.createElement('a');
  var blobURL = (saver.href = URL.createObjectURL(
      new Blob([JSON.stringify(settingsStore.settings, undefined, 2)]),
    )),
    body = document.body;

  saver.download = 'Family tree settings.json';

  body.appendChild(saver);
  saver.dispatchEvent(new MouseEvent('click'));
  body.removeChild(saver);
  URL.revokeObjectURL(blobURL);
}

async function loadXml() {
  const content = await xmlInput.value?.files?.[0].text();

  if (content) {
    familyStore.loadData(content);
  }
}

async function loadSettings() {
  const content = await settingsInput.value?.files?.[0].text();

  if (content) {
    const newSettinggs = JSON.parse(content);
    settingsStore.reset(newSettinggs);
  }
}
</script>

<template>
  <header>
    <h1 class="title">Wastvedt Family Tree</h1>
    <div class="buttons">
      <input
        type="file"
        ref="xmlInput"
        accept=".xml"
        @change="loadXml"
        style="display: none"
      />
      <button @click="() => xmlInput?.click()">Load Gramps xml</button>
      <button @click="settingsStore.reset">Reset Settings</button>
      <button @click="exportSettings">Export Settings</button>
      <input
        type="file"
        ref="settingsInput"
        accept=".json"
        @change="loadSettings"
        style="display: none"
      />
      <button @click="() => settingsInput?.click()">Load Settings</button>
    </div>
  </header>

  <main>
    <Suspense>
      <TreeLoader />
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
./settingsStore
