include $(TOPDIR)/rules.mk
PKG_NAME:=linehub-firewall
PKG_RELEASE:=1
include $(INCLUDE_DIR)/package.mk
define Package/linehub-firewall
  SECTION:=net
  CATEGORY:=Network
  TITLE:=LineHub firewall integration
  DEPENDS:=+linehub-core +firewall4 +nftables
endef
define Package/linehub-firewall/install
	$(CP) ./files/* $(1)/
endef
$(eval $(call BuildPackage,linehub-firewall))
