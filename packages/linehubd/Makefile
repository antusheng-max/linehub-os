include $(TOPDIR)/rules.mk
PKG_NAME:=linehubd
PKG_RELEASE:=1
include $(INCLUDE_DIR)/package.mk
define Package/linehubd
  SECTION:=net
  CATEGORY:=Network
  TITLE:=LineHub control-plane daemon
  DEPENDS:=+linehub-core +ubus +ubusd
endef
define Package/linehubd/install
	$(CP) ./files/* $(1)/
endef
$(eval $(call BuildPackage,linehubd))
