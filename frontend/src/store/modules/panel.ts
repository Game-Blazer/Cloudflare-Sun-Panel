import { defineStore } from 'pinia'

const PANEL_KEY = 'sun-panel-state'

export interface PanelState {
  panelConfig: Panel.panelConfig
}

const defaultPanelConfig: Panel.panelConfig = {
  backgroundImageSrc: '',
  backgroundBlur: 0,
  backgroundMaskNumber: 0.3,
  iconStyle: 'text' as any,
  iconTextColor: '#ffffff',
  iconTextInfoHideDescription: false,
  iconTextIconHideTitle: false,
  logoText: 'Sun-Panel',
  logoImageSrc: '',
  clockShowSecond: true,
  clockColor: '#ffffff',
  searchBoxShow: true,
  searchBoxSearchIcon: true,
  marginTop: 40,
  marginBottom: 40,
  maxWidth: 1200,
  maxWidthUnit: 'px',
  marginX: 20,
  footerHtml: '',
  announcement: '',
  announcementDuration: 5,
  systemMonitorShow: false,
  systemMonitorShowTitle: true,
  systemMonitorPublicVisitModeShow: false,
}

export const usePanelState = defineStore('panel', {
  state: (): PanelState => {
    const saved = localStorage.getItem(PANEL_KEY)
    const parsed = saved ? JSON.parse(saved) : null
    return {
      panelConfig: parsed?.panelConfig || { ...defaultPanelConfig },
    }
  },

  actions: {
    setPanelConfig(config: Panel.panelConfig) {
      this.panelConfig = { ...defaultPanelConfig, ...config }
      this.save()
    },

    updatePanelConfigFromCloud(config: Panel.panelConfig) {
      this.setPanelConfig(config)
    },

    save() {
      localStorage.setItem(PANEL_KEY, JSON.stringify({
        panelConfig: this.panelConfig,
      }))
    },
  },
})