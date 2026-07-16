include $(TOPDIR)/rules.mk

PKG_NAME:=linehub-core
PKG_RELEASE:=2

include $(INCLUDE_DIR)/package.mk

define Package/linehub-core
  SECTION:=net
  CATEGORY:=Network
  TITLE:=LineHub shared configuration model
  DEPENDS:=+uci +ubus
endef

define Package/linehub-core/install
	$(CP) ./files/* $(1)/
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) ./files/usr/sbin/linehub-validate $(1)/usr/sbin/linehub-validate
endef

$(eval $(call BuildPackage,linehub-core))
