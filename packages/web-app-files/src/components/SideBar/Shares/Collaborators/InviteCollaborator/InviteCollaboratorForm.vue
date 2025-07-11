<template>
  <div id="new-collaborators-form" data-testid="new-collaborators-form">
    <div :class="['oc-flex', 'oc-width-1-1', { 'new-collaborators-form-cern': isRunningOnEos }]">
      <oc-select
        v-if="isRunningOnEos"
        id="files-share-account-type-input"
        v-model="accountType"
        :options="accountTypes"
        :label="$gettext('Account type')"
        class="cern-account-type-input"
        :reduce="(option: AccountType) => option.description"
      >
        <template #option="{ description }">
          <span class="option oc-text-xsmall" v-text="description" />
        </template>
        <template #selected-option="{ description }">
          <span class="option oc-text-xsmall" v-text="description" />
        </template>
      </oc-select>
      <oc-select
        id="files-share-invite-input"
        ref="ocSharingAutocomplete"
        :class="['oc-width-1-1', { 'cern-files-share-invite-input': isRunningOnEos }]"
        :model-value="selectedCollaborators"
        :options="autocompleteResults"
        :loading="searchInProgress"
        :multiple="true"
        :filter="filterRecipients"
        :label="selectedCollaboratorsLabel"
        :dropdown-should-open="
          ({ open, search }: DropDownShouldOpenOptions) =>
            open && search.length >= minSearchLength && !searchInProgress
        "
        @search:input="onSearch"
        @update:model-value="resetFocusOnInvite"
        @open="onOpen"
        @close="onClose"
      >
        <template #option="option">
          <autocomplete-item class="mark-element" :item="option" />
        </template>
        <template #no-options>
          <span v-text="noOptionsLabel" />
        </template>
        <template #selected-option-container="{ option, deselect }">
          <recipient-container :key="option.id" :recipient="option" :deselect="deselect" />
        </template>
        <template #open-indicator>
          <!-- Empty to hide the caret -->
          <span />
        </template>
        <template #spinner="{ loading }">
          <oc-spinner
            v-if="loading"
            :aria-label="$gettext('Loading users and groups')"
            size="small"
          />
          <oc-filter-chip
            v-if="showShareTypeFilter"
            :filter-label="currentShareRoleType.label"
            class="invite-form-share-role-type"
            raw
            close-on-click
          >
            <template #default>
              <oc-button
                v-for="(option, index) in shareRoleTypes"
                :key="index"
                appearance="raw"
                size="medium"
                justify-content="space-between"
                class="invite-form-share-role-type-item oc-flex oc-flex-middle oc-width-1-1 oc-py-xs oc-px-s"
                :class="{ 'oc-secondary-container': option.id === currentShareRoleType.id }"
                @click="selectShareRoleType(option)"
              >
                <span>{{ option.longLabel }}</span>
                <div v-if="option.id === currentShareRoleType.id" class="oc-flex">
                  <oc-icon name="check" />
                </div>
              </oc-button>
            </template>
          </oc-filter-chip>
        </template>
      </oc-select>
    </div>
    <div class="oc-flex oc-flex-between oc-flex-wrap oc-mb-l oc-mt-s">
      <role-dropdown
        mode="create"
        :show-icon="isRunningOnEos"
        class="role-selection-dropdown"
        :is-external="isExternalShareRoleType"
        @option-change="collaboratorRoleChanged"
      />
      <div class="oc-flex oc-flex-middle">
        <expiration-date-indicator
          v-if="expirationDate"
          :expiration-date="DateTime.fromISO(expirationDate)"
          class="files-collaborators-collaborator-expiration oc-ml-xs oc-p-xs"
          data-testid="recipient-info-expiration-date"
        />
        <oc-button
          id="show-more-share-options-btn"
          class="oc-ml-xs raw-hover-surface oc-p-xs"
          :aria-label="$gettext('Show more actions')"
          appearance="raw"
        >
          <oc-icon name="more-2" />
          <oc-drop
            ref="showMoreShareOptionsDropRef"
            :drop-id="'show-more-share-options-drop'"
            :toggle="'#show-more-share-options-btn'"
            mode="click"
            padding-size="small"
          >
            <oc-list
              class="collaborator-edit-dropdown-options-list"
              :aria-label="'shareEditOptions'"
            >
              <li class="oc-rounded oc-menu-item-hover">
                <expiration-datepicker
                  v-if="!saving"
                  :share-types="selectedCollaborators.map(({ shareType }) => shareType)"
                  @option-change="collaboratorExpiryChanged"
                />
              </li>
            </oc-list>
          </oc-drop>
        </oc-button>
        <oc-button
          id="new-collaborators-form-create-button"
          key="new-collaborator-save-button"
          class="oc-ml-s"
          data-testid="new-collaborators-form-create-button"
          :disabled="!$_isValid || saving"
          :appearance="saving ? 'outline' : 'filled'"
          submit="submit"
          :show-spinner="savingDelayed"
          @click="share"
        >
          <span v-text="$gettext(saveButtonLabel)" />
        </oc-button>
      </div>
      <div class="oc-width-1-1 oc-mt-s">
        <oc-checkbox
          v-if="isRunningOnEos"
          v-model="notifyEnabled"
          :value="false"
          :label="$gettext('Notify via mail')"
        />
      </div>
    </div>
    <oc-hidden-announcer level="assertive" :announcement="announcement" />
  </div>
</template>

<script lang="ts">
import { debounce } from 'lodash-es'
import PQueue from 'p-queue'
import Mark from 'mark.js'
import { storeToRefs } from 'pinia'
import AutocompleteItem from './AutocompleteItem.vue'
import RoleDropdown from '../RoleDropdown.vue'
import RecipientContainer from './RecipientContainer.vue'
import ExpirationDatepicker from './ExpirationDatepicker.vue'
import {
  CollaboratorAutoCompleteItem,
  CollaboratorShare,
  ShareRole,
  ShareTypes,
  call
} from '@opencloud-eu/web-client'
import {
  useCapabilityStore,
  useClientService,
  useMessages,
  useSpacesStore,
  useConfigStore,
  useSharesStore,
  useUserStore
} from '@opencloud-eu/web-pkg'

import { computed, defineComponent, inject, ref, unref, watch, onMounted, nextTick, Ref } from 'vue'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { DateTime } from 'luxon'
import { OcDrop } from '@opencloud-eu/design-system/components'
import { useTask } from 'vue-concurrency'
import { useGettext } from 'vue3-gettext'
import { isProjectSpaceResource } from '@opencloud-eu/web-client'
import { Group } from '@opencloud-eu/web-client/graph/generated'
import ExpirationDateIndicator from '../../ExpirationDateIndicator.vue'

// just a dummy function to trick gettext tools
const $gettext = (str: string) => {
  return str
}

type AccountType = {
  prefix: string
  description: string
}

type DropDownShouldOpenOptions = { open: boolean; search: string[] }

export type ShareRoleType = { id: string; label: string; longLabel: string }

export default defineComponent({
  name: 'InviteCollaboratorForm',
  components: {
    ExpirationDateIndicator,
    AutocompleteItem,
    RoleDropdown,
    RecipientContainer,
    ExpirationDatepicker
  },
  props: {
    saveButtonLabel: {
      type: String,
      required: false,
      default: () => $gettext('Share')
    },
    inviteLabel: {
      type: String,
      required: false,
      default: ''
    }
  },

  setup() {
    const { $gettext } = useGettext()
    const clientService = useClientService()
    const { showMessage, showErrorMessage } = useMessages()
    const spacesStore = useSpacesStore()
    const { upsertSpace } = spacesStore
    const capabilityStore = useCapabilityStore()
    const capabilityRefs = storeToRefs(capabilityStore)
    const configStore = useConfigStore()
    const userStore = useUserStore()

    const sharesStore = useSharesStore()
    const { addShare } = sharesStore
    const { collaboratorShares } = storeToRefs(sharesStore)

    const searchQuery = ref('')
    const searchInProgress = ref(false)
    const autocompleteResults = ref<CollaboratorAutoCompleteItem[]>([])

    const saving = ref(false)
    const savingDelayed = ref(false)
    const notifyEnabled = ref(false)
    const expirationDate = ref<string>()
    const selectedCollaborators = ref<CollaboratorAutoCompleteItem[]>([])
    const announcement = ref<string>('')
    const selectedRole = ref<ShareRole>()

    const resource = inject<Resource>('resource')
    const space = inject<SpaceResource>('space')
    const availableInternalRoles = inject<Ref<ShareRole[]>>('availableInternalShareRoles')
    const availableExternalRoles = inject<Ref<ShareRole[]>>('availableExternalShareRoles')

    const markInstance = ref(null)

    const isOpen = ref(false)

    const onOpen = () => {
      isOpen.value = true
    }

    const onClose = () => {
      isOpen.value = false
    }

    watch(saving, (newValue) => {
      if (!newValue) {
        savingDelayed.value = false
        return
      }
      setTimeout(() => {
        if (!unref(saving)) {
          savingDelayed.value = false
          return
        }
        savingDelayed.value = true
      }, 700)
    })

    watch([autocompleteResults, isOpen], async () => {
      if (!unref(isOpen)) {
        return
      }

      await nextTick()
      unref(markInstance)?.unmark()
      unref(markInstance)?.mark(unref(searchQuery), {
        element: 'span',
        className: 'mark-highlight'
      })
    })

    const setInitialSelectedRole = () => {
      selectedRole.value = unref(isExternalShareRoleType)
        ? unref(availableExternalRoles)[0]
        : unref(availableInternalRoles)[0]
    }

    onMounted(async () => {
      setInitialSelectedRole()
      await nextTick()
      markInstance.value = new Mark('.mark-element')
    })

    const accountType = ref('standard')
    const accountTypes: AccountType[] = [
      { prefix: '', description: 'standard' },
      { prefix: 'a:', description: 'secondary' },
      { prefix: 'a:', description: 'service' },
      { prefix: 'l:', description: 'guest' },
      { prefix: 'sm:', description: 'federated' }
    ]

    const createSharesConcurrentRequests = computed(() => {
      return configStore.options.concurrentRequests.shares.create
    })

    const fetchRecipientsTask = useTask(function* (signal, query: string) {
      let filter: string
      if (unref(isExternalShareRoleType)) {
        // filter for external user types only
        filter = `(userType eq 'Federated')`
      }

      const client = clientService.graphAuthenticated
      const userData = yield* call(
        client.users.listUsers(
          { orderBy: ['displayName'], search: `"${query}"`, filter },
          { signal }
        )
      )

      let groupData: Group[]
      if (!unref(isExternalShareRoleType)) {
        // groups are only available for internal shares
        groupData = yield* call(
          client.groups.listGroups({ orderBy: ['displayName'], search: `"${query}"` }, { signal })
        )
      }

      const users = (userData || []).map((u) => ({
        ...u,
        shareType: unref(isExternalShareRoleType) ? ShareTypes.remote.value : ShareTypes.user.value
      })) as CollaboratorAutoCompleteItem[]

      const groups = (groupData || []).map((u) => ({
        ...u,
        shareType: ShareTypes.group.value
      })) as CollaboratorAutoCompleteItem[]

      autocompleteResults.value = [...users, ...groups].filter(
        (collaborator: CollaboratorAutoCompleteItem) => {
          if (collaborator.id === userStore.user.id) {
            // filter current user
            return false
          }

          const selected = unref(selectedCollaborators).some(({ id }) => collaborator.id === id)
          const existingShares = unref(collaboratorShares).filter((c) => !c.indirect)
          const exists = existingShares.some((s) => s.sharedWith.id === collaborator.id)

          if (selected || exists) {
            return false
          }

          announcement.value = $gettext('Person was added')

          return true
        }
      )
      searchInProgress.value = false
    }).restartable()

    const fetchRecipients = async (query: string) => {
      await fetchRecipientsTask.perform(query)
    }

    const share = async () => {
      saving.value = true

      const saveQueue = new PQueue({ concurrency: unref(createSharesConcurrentRequests) })
      const savePromises: Promise<void>[] = []
      const errors: { displayName: string; error: Error }[] = []
      const addedShares: CollaboratorShare[] = []

      unref(selectedCollaborators).forEach(({ id, shareType, displayName }) => {
        const type = shareType === ShareTypes.group.value ? 'group' : 'user'

        savePromises.push(
          saveQueue.add(async () => {
            try {
              const share = await addShare({
                clientService,
                space: unref(space),
                resource: unref(resource),
                options: {
                  roles: [unref(selectedRole).id],
                  expirationDateTime: unref(expirationDate),
                  recipients: [
                    {
                      objectId: id,
                      '@libre.graph.recipient.type': type
                    }
                  ]
                }
              })

              addedShares.push(share)
            } catch (error) {
              console.error(error)
              errors.push({ displayName, error })
              throw error
            }
          })
        )
      })

      const results = await Promise.allSettled(savePromises)

      if (isProjectSpaceResource(unref(resource))) {
        const updatedSpace = await clientService.graphAuthenticated.drives.getDrive(
          unref(resource).id
        )

        upsertSpace({ ...updatedSpace, graphPermissions: unref(space).graphPermissions })
      }

      if (results.length !== errors.length) {
        showMessage({ title: $gettext('Share was added successfully') })
      }

      errors.forEach((e) => {
        showErrorMessage({
          title: $gettext('Failed to add share for "%{displayName}"', {
            displayName: e.displayName
          }),
          errors: [e.error]
        })
      })

      expirationDate.value = null
      selectedCollaborators.value = []
      saving.value = false
    }

    const externalShareRolesEnabled = computed(() => unref(availableExternalRoles).length)

    const internalShareRoleType = '1'
    const externalShareRoleType = '2'
    const shareRoleTypes = computed<ShareRoleType[]>(() => [
      {
        id: internalShareRoleType,
        label: $gettext('Internal'),
        longLabel: $gettext('Internal users')
      },
      ...((unref(externalShareRolesEnabled) && [
        {
          id: externalShareRoleType,
          label: $gettext('External'),
          longLabel: $gettext('External users')
        }
      ]) ||
        [])
    ])
    const currentShareRoleType = ref<ShareRoleType>(unref(shareRoleTypes)[0])
    const isExternalShareRoleType = computed(
      () => unref(currentShareRoleType).id === externalShareRoleType
    )
    const selectShareRoleType = async (shareRoleType: ShareRoleType) => {
      if (unref(currentShareRoleType).id !== shareRoleType.id) {
        currentShareRoleType.value = shareRoleType
        selectedCollaborators.value = []

        if (unref(searchQuery)) {
          await fetchRecipients(unref(searchQuery))
        }
      }
      focusShareInput()
      setInitialSelectedRole()
    }

    const focusShareInput = () => {
      const inviteInput = document.getElementById('files-share-invite-input')
      if (inviteInput) {
        inviteInput.focus()
      }
    }

    const noOptionsLabel = computed(() => {
      if (unref(isExternalShareRoleType)) {
        return $gettext('No external users found.')
      }
      return $gettext('No users or groups found.')
    })

    const showShareTypeFilter = computed(
      () => unref(shareRoleTypes).length > 1 && !isProjectSpaceResource(unref(resource))
    )

    return {
      minSearchLength: capabilityRefs.sharingSearchMinLength,
      isRunningOnEos: computed(() => configStore.options.runningOnEos),
      saving,
      savingDelayed,
      searchInProgress,
      searchQuery,
      autocompleteResults,
      onOpen,
      onClose,
      expirationDate,
      selectedRole,
      announcement,
      selectedCollaborators,
      fetchRecipients,
      share,
      shareRoleTypes,
      currentShareRoleType,
      isExternalShareRoleType,
      selectShareRoleType,
      focusShareInput,
      noOptionsLabel,
      DateTime,
      showShareTypeFilter,
      showMessage,
      showErrorMessage,

      // CERN
      accountType,
      accountTypes,
      notifyEnabled,

      // unit tests
      fetchRecipientsTask
    }
  },

  computed: {
    $_isValid() {
      return this.selectedCollaborators.length > 0
    },

    selectedCollaboratorsLabel() {
      return this.inviteLabel || this.$gettext('Search')
    }
  },
  mounted() {
    this.fetchRecipients = debounce(this.fetchRecipients, 500)
  },

  methods: {
    onSearch(query: string) {
      this.autocompleteResults = []
      this.searchQuery = query

      if (query.length < this.minSearchLength) {
        this.searchInProgress = false

        return
      }

      this.searchInProgress = true

      // CERN
      if (this.isRunningOnEos) {
        const prefix =
          this.accountTypes.find((t) => t.description === this.accountType)?.prefix || ''
        query = `${prefix}${query}`
      }

      this.fetchRecipients(query)
    },

    filterRecipients(recipients: CollaboratorAutoCompleteItem[], query: string) {
      if (recipients.length < 1) {
        return []
      }

      // Allow advanced queries
      query = query.split(':')[1] || query

      return recipients.filter(
        (recipient) =>
          recipient.shareType === ShareTypes.remote.value ||
          recipient.displayName.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) > -1 ||
          recipient.mail?.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) > -1
      )
    },

    collaboratorRoleChanged(role: ShareRole) {
      this.selectedRole = role
    },

    collaboratorExpiryChanged({ expirationDate }: { expirationDate: string }) {
      this.expirationDate = expirationDate
      ;(this.$refs.showMoreShareOptionsDropRef as InstanceType<typeof OcDrop>).hide()
    },

    resetFocusOnInvite(event: CollaboratorAutoCompleteItem[]) {
      this.selectedCollaborators = event
      this.autocompleteResults = []
      this.searchQuery = ''
      this.$nextTick(() => {
        this.focusShareInput()
      })
    }
  }
})
</script>
<style lang="scss">
.role-selection-dropdown {
  max-width: 150px;
}

#new-collaborators-form-create-button {
  padding-left: 30px;
  padding-right: 30px;

  .oc-spinner {
    margin-left: -0.5rem;
  }
}

.new-collaborators-form-cern > .cern-files-share-invite-input {
  width: 75%;
}

.new-collaborators-form-cern > .cern-account-type-input {
  width: 30%;
}

#new-collaborators-form {
  .invite-form-share-role-type {
    .oc-filter-chip-button.oc-pill {
      padding: 0 !important;
    }

    &-item {
      margin-top: var(--oc-space-xsmall);

      &:first-child {
        margin-top: 0;
      }
    }

    .oc-drop {
      width: 180px;
    }
  }

  .vs__actions {
    padding: 0 !important;
    cursor: inherit;
    flex-wrap: nowrap;
  }
}
</style>
