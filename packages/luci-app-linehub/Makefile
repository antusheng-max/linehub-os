include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-linehub
PKG_RELEASE:=2
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-linehub
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LineHub Web administration
  DEPENDS:=+luci-base +luci-mod-network +linehub-core +linehubd +rpcd-mod-ucode +ucode-mod-fs
endef

define Build/Compile
endef

define Package/luci-app-linehub/install
	$(INSTALL_DIR) $(1)/www
	$(CP) ./htdocs/* $(1)/www/
	$(CP) ./root/* $(1)/
endef

$(eval $(call BuildPackage,luci-app-linehub))
