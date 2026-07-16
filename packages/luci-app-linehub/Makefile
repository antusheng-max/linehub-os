include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-linehub
PKG_RELEASE:=2

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-linehub
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LineHub Web administration
  DEPENDS:=+luci-base +rpcd +ucode +ucode-mod-ubus +linehub-core
endef

define Package/luci-app-linehub/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/linehub
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DIR) $(1)/usr/share/rpcd/ucode
	$(CP) ./htdocs/luci-static/resources/view/linehub/overview.js $(1)/www/luci-static/resources/view/linehub/
	$(CP) ./root/usr/share/luci/menu.d/luci-app-linehub.json $(1)/usr/share/luci/menu.d/
	$(CP) ./root/usr/share/rpcd/acl.d/luci-app-linehub.json $(1)/usr/share/rpcd/acl.d/
	$(CP) ./root/usr/share/rpcd/ucode/linehub.uc $(1)/usr/share/rpcd/ucode/
endef

$(eval $(call BuildPackage,luci-app-linehub))
