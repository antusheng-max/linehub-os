include $(TOPDIR)/rules.mk
PKG_NAME:=linehub-diagnostics
PKG_RELEASE:=1
include $(INCLUDE_DIR)/package.mk
define Package/linehub-diagnostics
  SECTION:=net
  CATEGORY:=Network
  TITLE:=LineHub read-only diagnostics
  DEPENDS:=+linehub-core +ubus
endef
define Package/linehub-diagnostics/install
	$(CP) ./files/* $(1)/
endef
$(eval $(call BuildPackage,linehub-diagnostics))
