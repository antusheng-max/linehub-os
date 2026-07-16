include $(TOPDIR)/rules.mk

PKG_NAME:=linehub-core
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/linehub-core
  SECTION:=net
  CATEGORY:=Network
  TITLE:=LineHub shared configuration model
  DEPENDS:=+uci +ubus
endef

define Package/linehub-core/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DIR) $(1)/usr/lib/linehub
	$(INSTALL_DIR) $(1)/usr/sbin
	$(CP) ./files/etc/config/linehub $(1)/etc/config/
	$(CP) ./files/usr/lib/linehub/schema.md $(1)/usr/lib/linehub/
	$(INSTALL_BIN) ./files/usr/sbin/linehub-validate $(1)/usr/sbin/
endef

$(eval $(call BuildPackage,linehub-core))
