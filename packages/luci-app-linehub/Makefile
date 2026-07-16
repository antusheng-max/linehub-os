include $(TOPDIR)/rules.mk
PKG_NAME:=luci-app-linehub
PKG_RELEASE:=1
include $(INCLUDE_DIR)/package.mk
define Package/luci-app-linehub
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LineHub Web administration
  DEPENDS:=+luci-base +linehub-core +linehubd
endef
define Package/luci-app-linehub/install
	$(CP) ./files/* $(1)/
endef
$(eval $(call BuildPackage,luci-app-linehub))
