<template>
  <div
    class="space-header oc-p-m"
    :class="{ 'oc-flex': !imageExpanded && !isMobileWidth, 'space-header-squashed': isSideBarOpen }"
  >
    <div
      class="space-header-image"
      :class="{ 'space-header-image-expanded': imageExpanded || isMobileWidth }"
    >
      <div
        v-if="imagesLoading.includes(space.id)"
        class="oc-height-1-1 oc-flex oc-flex-middle oc-flex-center"
      >
        <oc-spinner :aria-label="$gettext('Space image is loading')" />
      </div>
      <img
        v-else-if="imageContent"
        class="oc-cursor-pointer"
        alt=""
        :src="imageContent"
        @click="toggleImageExpanded"
      />
    </div>
    <div class="space-header-infos">
      <div class="oc-flex oc-mb-s oc-flex-middle oc-flex-between">
        <div class="oc-flex oc-flex-middle space-header-infos-heading">
          <h2 class="space-header-name">{{ space.name }}</h2>
          <oc-button
            :id="`space-context-btn`"
            v-oc-tooltip="$gettext('Show context menu')"
            :aria-label="$gettext('Show context menu')"
            appearance="raw"
            class="oc-ml-s oc-p-xs"
          >
            <oc-icon name="more-2" />
          </oc-button>
          <oc-drop
            :drop-id="`space-context-drop`"
            :toggle="`#space-context-btn`"
            mode="click"
            close-on-click
            :options="{ delayHide: 0 }"
            padding-size="small"
            position="right-start"
          >
            <space-context-actions :action-options="{ resources: [space] }" />
          </oc-drop>
        </div>
        <oc-button
          v-if="memberCount"
          :aria-label="$gettext('Open context menu and show members')"
          appearance="raw"
          no-hover
          @click="openSideBarSharePanel"
        >
          <oc-icon name="group" fill-type="line" size="small" />
          <span
            v-if="memberCount"
            class="space-header-people-count oc-text-small"
            v-text="memberCountString"
          />
          <oc-spinner v-else size="small" :aria-label="$gettext('Loading members')" />
        </oc-button>
      </div>
      <p v-if="space.description" class="oc-mt-rm oc-text-bold">{{ space.description }}</p>
      <div
        v-if="readmesLoading.includes(space.id)"
        class="space-header-readme-loading oc-flex oc-flex-middle oc-flex-center"
      >
        <oc-spinner :aria-label="$gettext('Space description is loading')" />
      </div>
      <div
        v-else-if="markdownResource && markdownContent"
        ref="markdownContainerRef"
        class="markdown-container oc-flex"
      >
        <text-editor
          class="markdown-container-content"
          is-read-only
          :current-content="markdownContent"
        />
        <div class="markdown-container-edit oc-ml-s">
          <oc-button
            type="router-link"
            size="small"
            :aria-label="$gettext('Edit description')"
            appearance="raw"
            class="oc-p-xs"
            :to="editReadMeContentLink"
          >
            <oc-icon name="pencil" size="small" fill-type="line" />
          </oc-button>
        </div>
      </div>
      <div
        v-if="showMarkdownCollapse && markdownContent"
        class="markdown-collapse oc-text-center oc-mt-s"
      >
        <oc-button appearance="raw" no-hover @click="toggleMarkdownCollapsed">
          <span>{{ toggleMarkdownCollapsedText }}</span>
        </oc-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, Ref, ref, unref, watch } from 'vue'
import { buildSpaceImageResource, Resource, SpaceResource } from '@opencloud-eu/web-client'
import {
  eventBus,
  ImageDimension,
  ProcessorType,
  SideBarEventTopics,
  TextEditor,
  useClientService,
  useFileActions,
  useLoadPreview,
  useResourcesStore,
  useSharesStore,
  useSpacesStore
} from '@opencloud-eu/web-pkg'
import SpaceContextActions from './SpaceContextActions.vue'
import { useGettext } from 'vue3-gettext'
import { DriveItem } from '@opencloud-eu/web-client/graph/generated'
import { storeToRefs } from 'pinia'

const markdownContainerCollapsedClass = 'collapsed'

const { space, isSideBarOpen = false } = defineProps<{
  space: SpaceResource
  isSideBarOpen?: boolean
}>()

const language = useGettext()
const { $gettext, $ngettext } = language
const clientService = useClientService()
const { getFileContents, getFileInfo } = clientService.webdav
const resourcesStore = useResourcesStore()
const { getDefaultAction } = useFileActions()
const { loadPreview } = useLoadPreview()
const spacesStore = useSpacesStore()
const sharesStore = useSharesStore()
const { imagesLoading, readmesLoading } = storeToRefs(spacesStore)

const isMobileWidth = inject<Ref<boolean>>('isMobileWidth')

const markdownContainerRef = ref(null)
const markdownContent = ref('')
const markdownResource = ref<Resource>(null)
const markdownCollapsed = ref(true)
const showMarkdownCollapse = ref(false)
const toggleMarkdownCollapsedText = computed(() => {
  return unref(markdownCollapsed) ? $gettext('Show more') : $gettext('Show less')
})
const toggleMarkdownCollapsed = () => {
  markdownCollapsed.value = !unref(markdownCollapsed)
  unref(markdownContainerRef).classList.toggle(markdownContainerCollapsedClass)
}
const onMarkdownResize = () => {
  if (!unref(markdownContainerRef)) {
    return
  }

  unref(markdownContainerRef).classList.remove(markdownContainerCollapsedClass)
  const markdownContainerHeight = unref(markdownContainerRef).offsetHeight
  if (markdownContainerHeight < 150) {
    showMarkdownCollapse.value = false
    return
  }
  showMarkdownCollapse.value = true

  if (unref(markdownCollapsed)) {
    unref(markdownContainerRef).classList.add(markdownContainerCollapsedClass)
  }
}
const markdownResizeObserver = new ResizeObserver(onMarkdownResize)
const observeMarkdownContainerResize = () => {
  if (!markdownResizeObserver || !unref(markdownContainerRef)) {
    return
  }
  markdownResizeObserver.unobserve(unref(markdownContainerRef))
  markdownResizeObserver.observe(unref(markdownContainerRef))
}
const unobserveMarkdownContainerResize = () => {
  if (!markdownResizeObserver || !unref(markdownContainerRef)) {
    return
  }
  markdownResizeObserver.unobserve(unref(markdownContainerRef))
}

const memberCount = ref<number>()
watch(
  () => sharesStore.collaboratorShares.length,
  async () => {
    // set space member count
    try {
      const { count } = await clientService.graphAuthenticated.permissions.listPermissions(
        space.id,
        space.id,
        sharesStore.graphRoles,
        { count: true, filter: "grantedToV2 ne ''" }
      )
      memberCount.value = count || 1
    } catch (e) {
      console.error(e)
    }
  },
  { immediate: true }
)

onMounted(observeMarkdownContainerResize)
onBeforeUnmount(() => {
  unobserveMarkdownContainerResize()
  spacesStore.purgeReadmesLoading()
})

const loadReadmeContent = async () => {
  spacesStore.addToReadmesLoading(space.id)

  try {
    const fileContentsResponse = await getFileContents(space, {
      path: `.space/${space.spaceReadmeData.name}`
    })

    const fileInfoResponse = await getFileInfo(space, {
      path: `.space/${space.spaceReadmeData.name}`
    })

    unobserveMarkdownContainerResize()
    markdownContent.value = fileContentsResponse.body
    markdownResource.value = fileInfoResponse
    spacesStore.removeFromReadmesLoading(space.id)

    await nextTick()
    if (unref(markdownContent)) {
      observeMarkdownContainerResize()
    }
  } catch (e) {
    if ([425, 429].includes(e.statusCode)) {
      const retryAfter = e.response?.headers?.['retry-after'] || 5
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
      return loadReadmeContent()
    }

    spacesStore.removeFromReadmesLoading(space.id)
    console.error(e)
  }
}

watch(
  computed(() => space.spaceReadmeData),
  async (data: DriveItem) => {
    if (!data) {
      return
    }

    await loadReadmeContent()
  },
  { deep: true, immediate: true }
)

const imageContent = ref<string>(null)
const imageExpanded = ref(false)

const editReadMeContentLink = computed(() => {
  const action = getDefaultAction({ resources: [unref(markdownResource)], space })

  if (!action.route) {
    return null
  }

  return action.route({ space, resources: [unref(markdownResource)] })
})
const toggleImageExpanded = () => {
  imageExpanded.value = !unref(imageExpanded)
}

watch(
  computed(() => space.spaceImageData),
  async () => {
    imageContent.value = await loadPreview({
      space,
      resource: space.spaceImageData ? buildSpaceImageResource(space) : space,
      dimensions: ImageDimension.Tile,
      processor: ProcessorType.enum.fit,
      cancelRunning: true,
      updateStore: false
    })
  },
  { immediate: true }
)

const memberCountString = computed(() => {
  return $ngettext('%{count} member', '%{count} members', unref(memberCount), {
    count: unref(memberCount).toString()
  })
})

const openSideBarSharePanel = () => {
  resourcesStore.setSelection([])
  eventBus.publish(SideBarEventTopics.openWithPanel, 'space-share')
}
</script>

<style lang="scss">
.space-header {
  &-squashed {
    .space-header-image {
      @media only screen and (max-width: 1200px) {
        display: none;
      }
    }
  }

  &-image {
    width: 280px;
    min-width: 280px;
    aspect-ratio: 16 / 9;
    margin-right: var(--oc-space-large);
    max-height: 158px;

    &-default {
      height: 100%;
      border-radius: 10px;
    }

    &-expanded {
      width: 100%;
      margin: 0;
      max-height: 100%;
      max-width: 100%;
    }

    img {
      border-radius: 10px;
      height: 100%;
      width: 100%;
      max-height: 100%;
      object-fit: cover;
    }
  }

  &-infos {
    flex: 1;

    &-heading {
      max-width: 100%;
    }
  }

  &-name {
    font-size: 1.5rem;
    word-break: break-all;
  }

  &-people-count {
    white-space: nowrap;
  }

  .markdown-container {
    &-content {
      .md-editor-preview-wrapper {
        padding: 0;
      }
    }
  }

  .markdown-container.collapsed {
    max-height: 100px;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(180deg, #000 90%, transparent);
  }
}
</style>
