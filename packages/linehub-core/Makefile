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
	$(CP) ./files/* $(1)/
endef

$(eval $(call BuildPackage,linehub-core))
