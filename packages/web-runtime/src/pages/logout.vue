<template>
  <div class="oc-height-viewport oc-flex oc-flex-column oc-flex-center oc-flex-middle">
    <div class="oc-login-card">
      <img class="oc-login-logo" :src="logoImg" alt="" :aria-hidden="true" />
      <div class="oc-login-card-body oc-width-medium">
        <h2 class="oc-login-card-title" v-text="cardTitle" />
        <p v-text="cardHint" />
      </div>
      <div class="oc-login-card-footer oc-pt-rm">
        <p>
          {{ footerSlogan }}
        </p>
      </div>
    </div>
    <oc-button
      id="exitAnchor"
      class="oc-mt-m oc-width-medium"
      size="large"
      appearance="filled"
      color-role="primary"
      v-bind="loginButtonAttrs"
    >
      {{ loginButtonText }}
    </oc-button>
  </div>
</template>
<script lang="ts">
import { computed, defineComponent, unref } from 'vue'
import { useConfigStore, useThemeStore } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import { storeToRefs } from 'pinia'

export default defineComponent({
  name: 'LogoutPage',
  setup() {
    const { $gettext } = useGettext()
    const themeStore = useThemeStore()
    const { currentTheme } = storeToRefs(themeStore)
    const configStore = useConfigStore()

    const cardTitle = computed(() => {
      return $gettext('Logged out')
    })
    const cardHint = computed(() => {
      return $gettext('You have been logged out successfully.')
    })
    const loginButtonText = computed(() => {
      return $gettext('Log in again')
    })
    const loginButtonAttrs = computed(() => {
      if (configStore.options.loginUrl) {
        const configLoginURL = new URL(encodeURI(configStore.options.loginUrl))
        return {
          type: 'a' as const,
          href: configLoginURL.toString()
        }
      }
      return {
        type: 'router-link' as const,
        to: {
          name: 'login'
        }
      }
    })

    const footerSlogan = computed(() => unref(currentTheme).slogan)
    const logoImg = computed(() => unref(currentTheme).logo)

    return {
      logoImg,
      cardTitle,
      cardHint,
      footerSlogan,
      loginButtonText,
      loginButtonAttrs
    }
  }
})
</script>
