<template>
  <portal to="app.runtime.header.left">
    <div class="oc-app-top-bar oc-flex">
      <span class="oc-app-top-bar-inner oc-pl-m oc-pr-xs oc-flex oc-flex-middle oc-flex-between">
        <div class="open-file-bar oc-flex">
          <resource-list-item
            v-if="resource"
            id="app-top-bar-resource"
            :is-thumbnail-displayed="false"
            :is-extension-displayed="areFileExtensionsShown"
            :path-prefix="getPathPrefix(resource)"
            :resource="resource"
            :parent-folder-name="getParentFolderName(resource)"
            :parent-folder-link-icon-additional-attributes="
              getParentFolderLinkIconAdditionalAttributes(resource)
            "
            :is-path-displayed="isPathDisplayed"
            :is-resource-clickable="false"
          />
        </div>
        <div class="oc-flex main-actions">
          <template v-if="dropDownMenuSections.length">
            <oc-button
              id="oc-openfile-contextmenu-trigger"
              v-oc-tooltip="contextMenuLabel"
              :aria-label="contextMenuLabel"
              appearance="raw-inverse"
              color-role="chrome"
              class="oc-p-xs"
            >
              <oc-icon name="more-2" />
            </oc-button>
            <oc-drop
              drop-id="oc-openfile-contextmenu"
              mode="click"
              padding-size="small"
              toggle="#oc-openfile-contextmenu-trigger"
              close-on-click
              @click.stop.prevent
            >
              <context-action-menu
                :menu-sections="dropDownMenuSections"
                :action-options="dropDownActionOptions"
              />
            </oc-drop>
          </template>
          <span v-if="hasAutosave" class="oc-flex oc-flex-middle">
            <oc-icon
              v-oc-tooltip="autoSaveTooltipText"
              :accessible-label="autoSaveTooltipText"
              name="refresh"
              color="white"
              class="ox-p-xs oc-mx-xs"
            />
          </span>
          <template v-if="mainActions.length && resource">
            <context-action-menu
              :menu-sections="[
                {
                  name: 'main-actions',
                  items: mainActions
                    .filter((action) => action.isVisible())
                    .map((action) => {
                      return {
                        ...action,
                        class: 'oc-p-xs app-topbar-action',
                        hideLabel: true
                      }
                    })
                }
              ]"
              :action-options="{
                resources: [resource]
              }"
              appearance="raw-inverse"
              color-role="chrome"
            />
          </template>
          <oc-button
            id="app-top-bar-close"
            appearance="raw-inverse"
            color-role="chrome"
            class="oc-p-xs"
            :aria-label="$gettext('Close')"
            @click="$emit('close')"
          >
            <oc-icon name="close" />
          </oc-button>
        </div>
      </span>
    </div>
  </portal>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, unref } from 'vue'
import ContextActionMenu from './ContextActions/ContextActionMenu.vue'
import { useGettext } from 'vue3-gettext'
import {
  Action,
  FileActionOptions,
  useConfigStore,
  useFolderLink,
  useGetMatchingSpace,
  useResourcesStore
} from '../composables'
import ResourceListItem from './FilesList/ResourceListItem.vue'
import { isPublicSpaceResource, Resource } from '@opencloud-eu/web-client'
import { Duration } from 'luxon'
import { MenuSection } from './ContextActions'

export default defineComponent({
  name: 'AppTopBar',
  components: {
    ContextActionMenu,
    ResourceListItem
  },
  props: {
    dropDownMenuSections: {
      type: Array as PropType<MenuSection[]>,
      default: (): MenuSection[] => []
    },
    dropDownActionOptions: {
      type: Object as PropType<FileActionOptions>,
      default: (): FileActionOptions => ({
        space: null,
        resources: []
      })
    },
    mainActions: {
      type: Array as PropType<Action[]>,
      default: (): Action[] => []
    },
    hasAutoSave: {
      type: Boolean,
      default: true
    },
    isEditor: {
      type: Boolean,
      default: false
    },
    resource: {
      type: Object as PropType<Resource>,
      default: null
    }
  },
  emits: ['close'],
  setup(props) {
    const { $gettext, current: currentLanguage } = useGettext()
    const resourcesStore = useResourcesStore()
    const configStore = useConfigStore()
    const { getMatchingSpace } = useGetMatchingSpace()

    const areFileExtensionsShown = computed(() => resourcesStore.areFileExtensionsShown)
    const contextMenuLabel = computed(() => $gettext('Show context menu'))
    const hasAutosave = computed(
      () => props.isEditor && props.hasAutoSave && configStore.options.editor.autosaveEnabled
    )
    const autoSaveTooltipText = computed(() => {
      const duration = Duration.fromObject(
        { seconds: configStore.options.editor.autosaveInterval },
        { locale: currentLanguage }
      )
      return $gettext(`Autosave (every %{ duration })`, { duration: duration.toHuman() })
    })

    const space = computed(() => getMatchingSpace(props.resource))

    const isPathDisplayed = computed(() => {
      return !isPublicSpaceResource(unref(space))
    })

    return {
      contextMenuLabel,
      areFileExtensionsShown,
      hasAutosave,
      autoSaveTooltipText,
      isPathDisplayed,
      ...useFolderLink()
    }
  }
})
</script>

<style lang="scss">
.oc-app-top-bar {
  align-self: center;
  grid-column: 1 / 4;
  grid-row: secondRow;

  @media (min-width: $oc-breakpoint-small-default) {
    grid-column: 2;
    grid-row: 1;
  }
}

.oc-app-top-bar-inner {
  align-self: center;
  background-color: var(--oc-role-chrome);
  border-radius: 10px;
  border: 1px solid var(--oc-role-on-chrome);
  display: inline-flex;
  gap: 25px;
  height: 40px;
  margin: 10px auto;
  width: 100%;

  @media (min-width: $oc-breakpoint-small-default) {
    flex-basis: 250px;
    margin: 0;
  }

  .oc-resource-indicators {
    .text {
      color: var(--oc-role-on-chrome);
    }
  }
}

.app-topbar-action {
  color: var(--oc-role-on-chrome) !important;

  svg {
    fill: var(--oc-role-on-chrome) !important;
  }

  &:hover:not(:disabled) {
    color: var(--oc-role-on-surface) !important;

    svg {
      fill: var(--oc-role-on-surface) !important;
    }
  }
}

.open-file-bar {
  #app-top-bar-resource {
    max-width: 360px;

    @media (max-width: $oc-breakpoint-medium-default) {
      max-width: 240px;
    }

    @media (min-width: $oc-breakpoint-small-default) {
      widows: initial;
    }

    svg,
    .oc-resource-name span {
      fill: var(--oc-role-on-chrome) !important;
      color: var(--oc-role-on-chrome) !important;
    }
  }

  .oc-resource-icon:hover,
  .oc-resource-name:hover {
    cursor: default;
    text-decoration: none;
  }
}
</style>
