define(`/static/js/mixins/mixin.dom.helper.js`, [], 
    function DomHelper() {
        return {
            name: `DomHelper`,
            kind: bindings.observable(`mixin`),
            
            getWidget: (name, view=null) => {
                return ctor.$component(name, ctor.view || view);
            },

            $component: (name, view) => {
                var $comp = undefined != view && null != view ? $(`#${name}`. view) : $(`#${name}`);
                if($comp?.length > 0) return $comp;
                return null;
            }
        }
    }
)