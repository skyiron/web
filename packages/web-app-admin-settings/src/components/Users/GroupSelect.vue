<template>
  <div id="user-group-select-form">
    <oc-select
      :model-value="selectedOptions"
      class="oc-mb-s"
      :multiple="true"
      :options="groupOptions"
      option-label="displayName"
      :label="$gettext('Groups')"
      :fix-message-line="true"
      v-bind="$attrs"
      :required-mark="requiredMark"
      @update:model-value="onUpdate"
    >
      <template #selected-option="{ displayName, id }">
        <span class="oc-flex oc-flex-center">
          <avatar-image
            class="oc-flex oc-align-self-center oc-mr-s"
            :width="16.8"
            :userid="id"
            :user-name="displayName"
          />
          <span>{{ displayName }}</span>
        </span>
      </template>
      <template #option="{ displayName, id }">
        <div class="oc-flex">
          <span class="oc-flex oc-flex-center">
            <avatar-image
              class="oc-flex oc-align-self-center oc-mr-s"
              :width="16.8"
              :userid="id"
              :user-name="displayName"
            />
            <span>{{ displayName }}</span>
          </span>
        </div>
      </template>
    </oc-select>
  </div>
</template>
<script lang="ts">
import { computed, defineComponent, PropType, ref, unref, watch } from 'vue'
import { Group } from '@opencloud-eu/web-client/graph/generated'

export default defineComponent({
  name: 'GroupSelect',
  props: {
    selectedGroups: {
      type: Array as PropType<Group[]>,
      required: true
    },
    groupOptions: {
      type: Array as PropType<Group[]>,
      required: true
    },
    requiredMark: {
      type: Boolean,
      default: false,
      required: false
    }
  },
  emits: ['selectedOptionChange'],
  setup(props, { emit }) {
    const selectedOptions = ref()
    const onUpdate = (group: Group) => {
      selectedOptions.value = group
      emit('selectedOptionChange', unref(selectedOptions))
    }

    const currentGroups = computed(() => props.selectedGroups)
    watch(
      currentGroups,
      () => {
        selectedOptions.value = props.selectedGroups
          .map((g) => ({
            ...g,
            readonly: g.groupTypes?.includes('ReadOnly')
          }))
          .sort((a: any, b: any) => b.readonly - a.readonly)
      },
      { immediate: true }
    )

    return { selectedOptions, onUpdate }
  }
})
</script>
