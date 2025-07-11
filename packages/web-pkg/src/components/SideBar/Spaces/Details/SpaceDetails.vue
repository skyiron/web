<template>
  <div id="oc-space-details-sidebar">
    <div class="oc-space-details-sidebar-image oc-text-center">
      <oc-spinner
        v-if="imagesLoading.includes(resource.id)"
        :aria-label="$gettext('Space image is loading')"
      />
      <div v-else-if="spaceImage" class="oc-position-relative">
        <img :src="spaceImage" alt="" />
      </div>
      <oc-icon
        v-else
        name="layout-grid"
        size="xxlarge"
        class="space-default-image oc-px-m oc-py-m"
      />
    </div>
    <div
      v-if="showShareIndicators && hasShares && !resource.disabled"
      class="oc-flex oc-flex-middle oc-space-details-sidebar-members oc-mb-s oc-text-small"
    >
      <oc-button
        v-if="hasMemberShares"
        appearance="raw"
        :aria-label="openSharesPanelMembersHint"
        no-hover
        @click="expandSharesPanel"
      >
        <oc-icon name="group" size="small" fill-type="line" />
      </oc-button>
      <oc-button
        v-if="hasLinkShares"
        appearance="raw"
        :aria-label="openSharesPanelLinkHint"
        no-hover
        @click="expandSharesPanel"
      >
        <oc-icon name="link" size="small" fill-type="line" />
      </oc-button>
      <p v-text="shareLabel" />
      <oc-button
        appearance="raw"
        :aria-label="openSharesPanelHint"
        size="small"
        no-hover
        @click="expandSharesPanel"
      >
        <span class="oc-text-small" v-text="$gettext('Show')" />
      </oc-button>
    </div>
    <dl
      class="details-list oc-m-rm"
      :aria-label="$gettext('Overview of the information about the selected space')"
    >
      <dt>{{ $gettext('Last activity') }}</dt>
      <dd>{{ lastModifiedDate }}</dd>
      <template v-if="resource.description">
        <dt>{{ $gettext('Subtitle') }}</dt>
        <dd>{{ resource.description }}</dd>
      </template>
      <dt>{{ $gettext('Manager') }}</dt>
      <dd>{{ ownerUsernames }}</dd>
      <template v-if="!resource.disabled">
        <dt>{{ $gettext('Quota') }}</dt>
        <dd>
          <space-quota :space-quota="resource.spaceQuota" />
        </dd>
      </template>
      <template v-if="showSize">
        <dt>{{ $gettext('Size') }}</dt>
        <dd>{{ size }}</dd>
      </template>
      <web-dav-details v-if="showWebDavDetails" :space="resource" />
      <portal-target
        name="app.files.sidebar.space.details.table"
        :slot-props="{ space: resource, resource }"
        :multiple="true"
      />
    </dl>
  </div>
</template>
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, inject, Ref, ref, unref, watch } from 'vue'
import { buildSpaceImageResource, isManager, SpaceResource } from '@opencloud-eu/web-client'
import {
  SideBarEventTopics,
  useLoadPreview,
  useResourceContents,
  useResourcesStore,
  useRouter,
  useSharesStore,
  useSpacesStore,
  useUserStore
} from '../../../../composables'
import SpaceQuota from '../../../SpaceQuota.vue'
import WebDavDetails from '../../WebDavDetails.vue'
import { formatDateFromISO, formatFileSize } from '../../../../helpers'
import { eventBus } from '../../../../services/eventBus'
import { ImageDimension } from '../../../../constants'
import { ProcessorType } from '../../../../services'
import { isLocationSpacesActive } from '../../../../router'
import { useGettext } from 'vue3-gettext'

const { showShareIndicators = true } = defineProps<{
  showShareIndicators?: boolean
}>()

const userStore = useUserStore()
const resourcesStore = useResourcesStore()
const { resourceContentsText } = useResourceContents({ showSizeInformation: false })
const router = useRouter()
const { $gettext, $ngettext, current: currentLanguage } = useGettext()
const { loadPreview } = useLoadPreview()
const spacesStore = useSpacesStore()
const { imagesLoading } = storeToRefs(spacesStore)

const sharesStore = useSharesStore()

const resource = inject<Ref<SpaceResource>>('resource')
const spaceImage = ref('')

const { user } = storeToRefs(userStore)

const spaceMembers = computed(() => {
  return spacesStore.getSpaceMembers(unref(resource))
})

const linkShareCount = computed(() => sharesStore.linkShares.length)
const showWebDavDetails = computed(() => resourcesStore.areWebDavDetailsShown)
const showSize = computed(() => {
  return !isLocationSpacesActive(router, 'files-spaces-projects')
})
const size = computed(() => {
  return `${formatFileSize(unref(resource).size, currentLanguage)}, ${unref(resourceContentsText)}`
})

watch(
  () => unref(resource).spaceImageData,
  async () => {
    spaceImage.value = await loadPreview({
      space: unref(resource),
      resource: unref(resource).spaceImageData
        ? buildSpaceImageResource(unref(resource))
        : unref(resource),
      dimensions: ImageDimension.Tile,
      processor: ProcessorType.enum.fit,
      cancelRunning: true,
      updateStore: false
    })
  },
  { immediate: true }
)

const ownerUsernames = computed(() => {
  const managerPermissions = unref(spaceMembers).filter(isManager)
  return managerPermissions
    .map(({ sharedWith }) => {
      if (sharedWith.id === unref(user)?.id) {
        return $gettext('%{displayName} (me)', { displayName: sharedWith.displayName })
      }
      return sharedWith.displayName
    })
    .join(', ')
})

const lastModifiedDate = computed(() => {
  return formatDateFromISO(unref(resource).mdate, currentLanguage)
})

const hasShares = computed(() => {
  return unref(hasMemberShares) || unref(hasLinkShares)
})
const shareLabel = computed(() => {
  if (unref(hasMemberShares) && !unref(hasLinkShares)) {
    return unref(memberShareLabel)
  }
  if (!unref(hasMemberShares) && unref(hasLinkShares)) {
    return unref(linkShareLabel)
  }

  switch (unref(memberShareCount)) {
    case 1:
      return $ngettext(
        'This space has one member and %{linkShareCount} link.',
        'This space has one member and %{linkShareCount} links.',
        unref(linkShareCount),
        { linkShareCount: unref(linkShareCount).toString() }
      )
    default:
      if (unref(linkShareCount) === 1) {
        return $gettext('This space has %{memberShareCount} members and one link.', {
          memberShareCount: unref(memberShareCount).toString()
        })
      }
      return $gettext('This space has %{memberShareCount} members and %{linkShareCount} links.', {
        memberShareCount: unref(memberShareCount).toString(),
        linkShareCount: unref(linkShareCount).toString()
      })
  }
})
const openSharesPanelHint = computed(() => {
  return $gettext('Open share panel')
})
const openSharesPanelLinkHint = computed(() => {
  return $gettext('Open link list in share panel')
})
const openSharesPanelMembersHint = computed(() => {
  return $gettext('Open member list in share panel')
})
const hasMemberShares = computed(() => {
  return unref(memberShareCount) > 0
})
const hasLinkShares = computed(() => {
  return unref(linkShareCount) > 0
})
const memberShareCount = computed(() => {
  return unref(spaceMembers).length
})
const memberShareLabel = computed(() => {
  return $ngettext(
    'This space has %{memberShareCount} member.',
    'This space has %{memberShareCount} members.',
    unref(memberShareCount),
    { memberShareCount: unref(memberShareCount).toString() }
  )
})
const linkShareLabel = computed(() => {
  return $ngettext(
    '%{linkShareCount} link giving access.',
    '%{linkShareCount} links giving access.',
    unref(linkShareCount),
    { linkShareCount: unref(linkShareCount).toString() }
  )
})

const expandSharesPanel = () => {
  eventBus.publish(SideBarEventTopics.setActivePanel, 'space-share')
}
</script>
<style lang="scss" scoped>
#oc-space-details-sidebar {
  background-color: var(--oc-role-surface-container);
  border-radius: 5px;
  padding: var(--oc-space-medium);
}

.oc-space-details-sidebar {
  &-members {
    gap: var(--oc-space-small);
  }

  &-image img {
    aspect-ratio: 16 / 9;
    height: 100%;
    object-fit: cover;
    width: 100%;
  }
}
</style>
