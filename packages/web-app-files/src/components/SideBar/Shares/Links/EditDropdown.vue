<template>
  <div v-if="isModifiable || sharedAncestor" class="oc-flex">
    <oc-button
      :id="`edit-public-link-dropdown-toggl-${linkShare.id}`"
      :aria-label="$gettext('More options')"
      appearance="raw"
      class="edit-drop-trigger raw-hover-surface oc-p-xs"
    >
      <oc-icon name="more-2" />
    </oc-button>
    <oc-drop
      ref="editPublicLinkDropdown"
      :drop-id="`edit-public-link-dropdown`"
      :toggle="`#edit-public-link-dropdown-toggl-${linkShare.id}`"
      padding-size="small"
      mode="click"
    >
      <oc-list v-if="editOptions.length > 0" class="edit-public-link-dropdown-menu">
        <li v-for="(option, i) in editOptions" :key="i" class="oc-rounded oc-menu-item-hover">
          <context-menu-item :option="option" />
        </li>
      </oc-list>
      <oc-list
        v-if="sharedAncestor"
        class="edit-public-link-dropdown-menu edit-public-link-dropdown-menu-navigate-to-parent"
        :class="{ 'oc-pt-s': editOptions.length > 0 }"
      >
        <li class="oc-rounded oc-menu-item-hover">
          <context-menu-item :option="navigateToParentOption" />
        </li>
      </oc-list>
      <oc-list
        v-if="isModifiable"
        class="edit-public-link-dropdown-menu edit-public-link-dropdown-menu-delete"
        :class="{ 'oc-pt-s': editOptions.length > 0 }"
      >
        <li class="oc-rounded oc-menu-item-hover">
          <context-menu-item :option="deleteOption" />
        </li>
      </oc-list>
    </oc-drop>
  </div>
</template>

<script lang="ts">
import { DateTime } from 'luxon'
import {
  createLocationSpaces,
  useGetMatchingSpace,
  useModals,
  useResourcesStore
} from '@opencloud-eu/web-pkg'
import { LinkShare } from '@opencloud-eu/web-client'
import { computed, defineComponent, inject, PropType, Ref, unref, useTemplateRef } from 'vue'
import { Resource } from '@opencloud-eu/web-client'
import { createFileRouteOptions, DatePickerModal } from '@opencloud-eu/web-pkg'
import { OcDrop } from '@opencloud-eu/design-system/components'
import { useGettext } from 'vue3-gettext'
import { SharingLinkType } from '@opencloud-eu/web-client/graph/generated'
import { RouteLocationNamedRaw } from 'vue-router'
import ContextMenuItem from './ContextMenuItem.vue'

export type EditOption = {
  id: string
  title: string
  icon: string
  method?: () => void
  to?: RouteLocationNamedRaw
}

export default defineComponent({
  name: 'EditDropdown',
  components: { ContextMenuItem },
  props: {
    canRename: {
      type: Boolean,
      default: false
    },
    isModifiable: {
      type: Boolean,
      default: false
    },
    isPasswordRemovable: {
      type: Boolean,
      default: false
    },
    linkShare: {
      type: Object as PropType<LinkShare>,
      required: true
    }
  },
  emits: ['removePublicLink', 'updateLink', 'showPasswordModal'],
  setup(props, { emit }) {
    const { dispatchModal } = useModals()
    const { $gettext } = useGettext()
    const { getMatchingSpace } = useGetMatchingSpace()
    const resourcesStore = useResourcesStore()
    const editPublicLinkDropdown = useTemplateRef<typeof OcDrop>('editPublicLinkDropdown')

    const resource = inject<Ref<Resource>>('resource')

    const showDatePickerModal = () => {
      const currentDate = DateTime.fromISO(props.linkShare.expirationDateTime)

      dispatchModal({
        title: $gettext('Set expiration date'),
        hideActions: true,
        customComponent: DatePickerModal,
        customComponentAttrs: () => ({
          currentDate: currentDate.isValid ? currentDate : null,
          minDate: DateTime.now()
        }),
        onConfirm: (expirationDateTime: DateTime) => {
          emit('updateLink', {
            linkShare: { ...props.linkShare },
            options: { expirationDateTime }
          })
        }
      })
    }

    const isInternalLink = computed(() => {
      return props.linkShare.type === SharingLinkType.Internal
    })

    const sharedAncestor = computed(() => {
      if (!props.linkShare.indirect) {
        return null
      }

      return resourcesStore.getAncestorById(props.linkShare.resourceId)
    })

    const viaRouterParams = computed(() => {
      const matchingSpace = getMatchingSpace(unref(resource))
      if (!matchingSpace || !unref(sharedAncestor)) {
        return {}
      }

      return createLocationSpaces(
        'files-spaces-generic',
        createFileRouteOptions(matchingSpace, {
          path: unref(sharedAncestor).path,
          fileId: unref(sharedAncestor).id
        })
      )
    })

    const deleteOption = computed<EditOption>(() => {
      return {
        id: 'delete',
        title: $gettext('Delete link'),
        method: () => {
          emit('removePublicLink', { link: props.linkShare })
          unref(editPublicLinkDropdown).hide()
        },
        icon: 'delete-bin-5'
      }
    })

    const navigateToParentOption = computed<EditOption>(() => {
      return {
        id: 'open-shared-via',
        title: $gettext('Navigate to parent'),
        icon: 'folder-shared',
        to: unref(viaRouterParams)
      }
    })

    const showRenameModal = () => {
      dispatchModal({
        title: $gettext('Edit name'),
        confirmText: $gettext('Save'),
        hasInput: true,
        inputValue: props.linkShare.displayName,
        inputLabel: $gettext('Link name'),
        inputRequiredMark: true,
        onInput: (name, setError) => {
          if (!name.length) {
            return setError($gettext('Link name cannot be empty'))
          }
          if (name.length > 255) {
            return setError($gettext('Link name cannot exceed 255 characters'))
          }
          return setError(null)
        },
        onConfirm: (displayName: string) => {
          const linkShare = props.linkShare
          emit('updateLink', { linkShare, options: { displayName } })
        }
      })
    }

    const editOptions = computed<EditOption[]>(() => {
      const result: EditOption[] = []

      if (!props.isModifiable) {
        return result
      }

      if (props.canRename) {
        result.push({
          id: 'rename',
          title: $gettext('Rename'),
          icon: 'pencil',
          method: showRenameModal
        })
      }

      if (props.linkShare.expirationDateTime) {
        result.push({
          id: 'edit-expiration',
          title: $gettext('Edit expiration date'),
          icon: 'calendar-event',
          method: showDatePickerModal
        })

        result.push({
          id: 'remove-expiration',
          title: $gettext('Remove expiration date'),
          icon: 'calendar-close',
          method: () => {
            emit('updateLink', {
              linkShare: { ...props.linkShare },
              options: { expirationDateTime: null }
            })
            unref(editPublicLinkDropdown).hide()
          }
        })
      } else if (!unref(isInternalLink)) {
        result.push({
          id: 'add-expiration',
          title: $gettext('Set expiration date'),
          method: showDatePickerModal,
          icon: 'calendar-event'
        })
      }

      if (props.linkShare.hasPassword) {
        result.push({
          id: 'edit-password',
          title: $gettext('Edit password'),
          icon: 'lock-password',
          method: () => emit('showPasswordModal')
        })

        if (props.isPasswordRemovable) {
          result.push({
            id: 'remove-password',
            title: $gettext('Remove password'),
            icon: 'lock-unlock',
            method: () =>
              emit('updateLink', { linkShare: props.linkShare, options: { password: '' } })
          })
        }
      }
      if (!props.linkShare.hasPassword && !unref(isInternalLink)) {
        result.push({
          id: 'add-password',
          title: $gettext('Add password'),
          icon: 'lock-password',
          method: () => emit('showPasswordModal')
        })
      }

      return result
    })

    return {
      editPublicLinkDropdown,
      sharedAncestor,
      editOptions,
      deleteOption,
      navigateToParentOption
    }
  }
})
</script>

<style lang="scss" scoped>
.edit-public-link-dropdown-menu {
  .action-menu-item {
    width: 100%;
    justify-content: flex-start;
  }

  &-delete {
    margin-top: var(--oc-space-small) !important;
    border-top: 0.5px solid var(--oc-role-outline-variant) !important;
  }
}
</style>
