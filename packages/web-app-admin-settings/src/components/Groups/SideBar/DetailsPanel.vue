<template>
  <div v-if="noGroups" class="oc-flex group-info oc-text-center oc-mt-xl">
    <oc-icon name="group-2" size="xxlarge" />
    <p v-translate>Select a group to view details</p>
  </div>
  <div v-if="multipleGroups" id="oc-groups-details-multiple-sidebar" class="oc-flex group-info">
    <oc-icon name="group-2" size="xxlarge" />
    <p>{{ multipleGroupsSelectedText }}</p>
  </div>
  <div v-if="group" id="oc-group-details-sidebar">
    <GroupInfoBox :group="group" />
    <p
      class="selected-group-details"
      :aria-label="$gettext('Overview of the information about the selected group')"
    >
      <span class="oc-pr-s oc-font-semibold" v-text="$gettext('Group name')" />
      <span v-text="group.displayName" />
    </p>
  </div>
</template>
<script lang="ts">
import { defineComponent, PropType } from 'vue'
import GroupInfoBox from './GroupInfoBox.vue'
import { Group } from '@opencloud-eu/web-client/graph/generated'

export default defineComponent({
  name: 'DetailsPanel',
  components: { GroupInfoBox },
  props: {
    groups: {
      type: Array as PropType<Group[]>,
      required: true
    }
  },
  computed: {
    group() {
      return this.groups.length === 1 ? this.groups[0] : null
    },
    noGroups() {
      return !this.groups.length
    },
    multipleGroups() {
      return this.groups.length > 1
    },
    multipleGroupsSelectedText() {
      return this.$gettext('%{count} groups selected', {
        count: this.groups.length.toString()
      })
    }
  }
})
</script>
<style lang="scss">
#oc-group-details-sidebar,
#oc-groups-details-multiple-sidebar {
  background-color: var(--oc-role-surface-container);
  border-radius: 5px;
  padding: var(--oc-space-medium);
}

.group-info {
  align-items: center;
  flex-direction: column;
}

.group-info-display-name {
  font-size: 1.5rem;
}

.selected-group-details {
  display: table;
  text-align: left;

  span {
    padding: 0.2rem;
  }
}
</style>
