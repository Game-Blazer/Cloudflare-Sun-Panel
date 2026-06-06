import { defineStore } from 'pinia'

export interface PanelState {
  panelConfig: Panel.panelConfig
}

const defaultPanelConfig: Panel.panelConfig = {
  backgroundImageSrc: '',
  backgroundBlur: 0,
  backgroundMaskNumber: 0.3,
  iconStyle: 'text' as Panel.PanelPanelConfigStyleEnum,
  iconTextColor: '#ffffff',
  iconTextInfoHideDescription: false,
  iconTextIconHideTitle: false,
  logoText: '',
  logoImageSrc: '',
  logoPositionTop: 16,
  logoPositionLeft: 16,
  logoSize: 48,
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
  announcementBlur: 12,
  announcementMaskOpacity: 0.15,
  systemMonitorShow: false,
  systemMonitorShowTitle: true,
  systemMonitorPublicVisitModeShow: false,
}

export const usePanelState = defineStore('panel', {
  state: (): PanelState => ({
    panelConfig: { ...defaultPanelConfig },
  }),

  actions: {
    setPanelConfig(config: Panel.panelConfig) {
      this.panelConfig = { ...defaultPanelConfig, ...config }
    },

    updatePanelConfigFromCloud(config: Panel.panelConfig) {
      this.setPanelConfig(config)
    },
  },
})
