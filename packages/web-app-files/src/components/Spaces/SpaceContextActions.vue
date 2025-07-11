<template>
  <div v-if="loading" class="oc-flex oc-flex-center oc-my-m">
    <oc-spinner :aria-label="$gettext('Loading actions')" />
  </div>
  <div v-else>
    <context-action-menu :menu-sections="menuSections" :action-options="actionOptions" />
    <input
      id="space-image-upload-input"
      ref="spaceImageInput"
      type="file"
      name="file"
      multiple
      tabindex="-1"
      accept="image/jpeg, image/png"
      @change="showModalImageSpace"
    />
  </div>
</template>

<script lang="ts">
import {
  ContextActionMenu,
  FileActionOptions,
  isLocationSpacesActive,
  SpaceActionOptions,
  useFileActionsDownloadArchive,
  useFileActionsShowDetails,
  useRouter,
  useSpaceActionsDelete,
  useSpaceActionsDeleteImage,
  useSpaceActionsDisable,
  useSpaceActionsDuplicate,
  useSpaceActionsEditDescription,
  useSpaceActionsEditQuota,
  useSpaceActionsEditReadmeContent,
  useSpaceActionsNavigateToTrash,
  useSpaceActionsRename,
  useSpaceActionsRestore,
  useSpaceActionsSetIcon,
  useSpaceActionsShowMembers
} from '@opencloud-eu/web-pkg'
import { useSpaceActionsUploadImage } from '../../composables'
import { computed, defineComponent, PropType, Ref, ref, toRef, unref, VNodeRef } from 'vue'
import { MenuSection } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'

export default defineComponent({
  name: 'SpaceContextActions',
  components: { ContextActionMenu },
  props: {
    actionOptions: {
      type: Object as PropType<SpaceActionOptions>,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const router = useRouter()
    const { $gettext } = useGettext()

    const actionOptions = toRef(props, 'actionOptions') as Ref<SpaceActionOptions>

    const { actions: deleteActions } = useSpaceActionsDelete()
    const { actions: disableActions } = useSpaceActionsDisable()
    const { actions: duplicateActions } = useSpaceActionsDuplicate()
    const { actions: editQuotaActions } = useSpaceActionsEditQuota()
    const { actions: editReadmeContentActions } = useSpaceActionsEditReadmeContent()
    const { actions: editDescriptionActions } = useSpaceActionsEditDescription()
    const { actions: setSpaceIconActions } = useSpaceActionsSetIcon()
    const { actions: deleteImageActions } = useSpaceActionsDeleteImage()
    const { actions: renameActions } = useSpaceActionsRename()
    const { actions: restoreActions } = useSpaceActionsRestore()
    const { actions: showDetailsActions } = useFileActionsShowDetails()
    const { actions: showMembersActions } = useSpaceActionsShowMembers()
    const { actions: downloadArchiveActions } = useFileActionsDownloadArchive()
    const { actions: navigateToTrashActions } = useSpaceActionsNavigateToTrash()

    const spaceImageInput: VNodeRef = ref(null)
    const { actions: uploadImageActions, showModalImageSpace } = useSpaceActionsUploadImage({
      spaceImageInput
    })

    const menuItemsMembers = computed(() => {
      const fileHandlers = [...unref(showMembersActions), ...unref(downloadArchiveActions)]
      // HACK: downloadArchiveActions requires FileActionOptions but we have SpaceActionOptions
      return [...fileHandlers].filter((item) => item.isVisible(unref(actionOptions) as any))
    })

    const menuItemsPrimaryActions = computed(() => {
      const fileHandlers = [
        ...unref(renameActions),
        ...unref(duplicateActions),
        ...unref(editDescriptionActions)
      ]

      if (isLocationSpacesActive(router, 'files-spaces-generic')) {
        fileHandlers.splice(2, 0, ...unref(editReadmeContentActions))
      }
      return [...fileHandlers].filter((item) => item.isVisible(unref(actionOptions)))
    })

    const menuItemsPrimaryDropActions = computed(() => {
      const fileHandlers = [
        ...unref(uploadImageActions),
        ...unref(setSpaceIconActions),
        ...unref(deleteImageActions)
      ]
      return [...fileHandlers].filter((item) => item.isVisible(unref(actionOptions)))
    })

    const menuItemsSecondaryActions = computed(() => {
      const fileHandlers = [
        ...unref(editQuotaActions),
        ...unref(disableActions),
        ...unref(restoreActions),
        ...unref(navigateToTrashActions),
        ...unref(deleteActions)
      ]

      return [...fileHandlers].filter((item) => item.isVisible(unref(actionOptions)))
    })

    const menuItemsSidebar = computed(() => {
      const fileHandlers = [...unref(showDetailsActions)]
      return [...fileHandlers].filter((item) =>
        // HACK: showDetails provides FileAction[] but we have SpaceActionOptions, so we need to cast them to FileActionOptions
        item.isVisible(unref(actionOptions) as unknown as FileActionOptions)
      )
    })

    const menuSections = computed(() => {
      const sections: MenuSection[] = []
      if (unref(menuItemsMembers).length) {
        sections.push({
          name: 'members',
          items: unref(menuItemsMembers)
        })
      }
      if ([...unref(menuItemsPrimaryActions), ...unref(menuItemsPrimaryDropActions)].length) {
        sections.push({
          name: 'primaryActions',
          items: unref(menuItemsPrimaryActions),
          dropItems: [
            {
              name: 'space-image',
              label: $gettext('Edit image'),
              icon: 'image',
              items: unref(menuItemsPrimaryDropActions)
            }
          ]
        })
      }
      if (unref(menuItemsSecondaryActions).length) {
        sections.push({
          name: 'secondaryActions',
          items: unref(menuItemsSecondaryActions)
        })
      }
      if (unref(menuItemsSidebar).length) {
        sections.push({
          name: 'sidebar',
          items: unref(menuItemsSidebar)
        })
      }

      return sections
    })

    return {
      menuSections,
      spaceImageInput,
      uploadImageActions,
      showModalImageSpace
    }
  }
})
</script>

<style lang="scss">
#space-image-upload-input {
  position: absolute;
  left: -99999px;
}
</style>
