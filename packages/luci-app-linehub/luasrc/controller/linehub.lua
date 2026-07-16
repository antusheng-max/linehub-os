-- LuCI menu skeleton. Runtime pages and ACL bindings are deferred beyond M0.
module("luci.controller.linehub", package.seeall)

function index()
  entry({"admin", "network", "linehub"}, firstchild(), _("LineHub"), 60).dependent = false
end
