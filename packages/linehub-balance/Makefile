include $(TOPDIR)/rules.mk
PKG_NAME:=linehub-balance
PKG_RELEASE:=1
include $(INCLUDE_DIR)/package.mk
define Package/linehub-balance
  SECTION:=net
  CATEGORY:=Network
  TITLE:=LineHub flow-balancing integration
  DEPENDS:=+linehub-core +nftables
endef
define Package/linehub-balance/install
	$(CP) ./files/* $(1)/
endef
$(eval $(call BuildPackage,linehub-balance))
