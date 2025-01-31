<template>
  <oc-button
    v-if="isResourceClickable"
    v-bind="componentProps"
    :target="linkTarget"
    :draggable="false"
    class="oc-resource-link"
    @dragstart.prevent.stop
    @click="emitClick"
  >
    <slot />
  </oc-button>
  <span v-else>
    <slot />
  </span>
</template>

<script lang="ts">
import { useConfigStore } from '../../composables'
import { storeToRefs } from 'pinia'
import { computed, PropType, unref } from 'vue'
import { RouteLocationRaw } from 'vue-router'

/**
 * Wraps content in a resource link
 */
export default {
  name: 'ResourceLink',
  props: {
    /**
     * The resource folder link
     */
    link: {
      type: Object as PropType<RouteLocationRaw>,
      required: false,
      default: null
    },
    /**
     * The resource to be displayed
     */
    resource: {
      type: Object,
      required: true
    },
    /**
     * Asserts whether clicking on the resource name triggers any action
     */
    isResourceClickable: {
      type: Boolean,
      required: false,
      default: true
    }
  },
  emits: ['click'],
  setup: (props) => {
    const configStore = useConfigStore()
    const { options } = storeToRefs(configStore)

    const linkTarget = computed(() => {
      return unref(options).cernFeatures && props.link && !props.resource.isFolder
        ? '_blank'
        : '_self'
    })

    return {
      linkTarget
    }
  },
  computed: {
    isNavigatable() {
      return (this.resource.isFolder || this.link) && !this.resource.disabled
    },
    componentProps() {
      const props = {
        appearance: 'raw',
        colorRole: 'secondary'
      }

      if (!this.isNavigatable) {
        return {
          ...props,
          type: 'button',
          gapSize: 'none',
          justifyContent: 'left'
        }
      }

      return {
        ...props,
        type: 'router-link',
        to: this.link
      }
    }
  },
  methods: {
    emitClick() {
      if (this.isNavigatable) {
        return
      }

      /**
       * Triggered when the resource is a file and the name is clicked
       */
      this.$emit('click')
    }
  }
}
</script>
<style lang="scss">
.oc-resource-link {
  // necessary for the focus outline to show up
  display: inline-flex;
}
</style>
