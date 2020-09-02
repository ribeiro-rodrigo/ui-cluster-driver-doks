/*!!!!!!!!!!!Do not change anything between here (the DRIVERNAME placeholder will be automatically replaced at buildtime)!!!!!!!!!!!*/
// https://github.com/rancher/ui/blob/master/lib/shared/addon/mixins/cluster-driver.js
import ClusterDriver from 'shared/mixins/cluster-driver';
//import AWS from 'aws-sdk'
import $ from 'jquery';
import Semver, { minor, coerce } from 'semver';
import { INSTANCE_TYPES, nameFromResource, tagsFromResource } from 'shared/utils/amazon';
import C from 'shared/utils/constants';
import { satisfies, coerceVersion } from 'shared/utils/parse-version';
// do not remove LAYOUT, it is replaced at build time with a base64 representation of the template of the hbs template
// we do this to avoid converting template to a js file that returns a string and the cors issues that would come along with that
const LAYOUT;
/*!!!!!!!!!!!DO NOT CHANGE END!!!!!!!!!!!*/

/*!!!!!!!!!!!GLOBAL CONST START!!!!!!!!!!!*/
// EMBER API Access - if you need access to any of the Ember API's add them here in the same manner rather then import them via modules, since the dependencies exist in rancher we dont want to expor the modules in the amd def
const computed = Ember.computed;
const observer = Ember.observer;
const get = Ember.get;
const set = Ember.set;
const setProperties = Ember.setProperties;
const alias = Ember.computed.alias;
const service = Ember.inject.service;
const all = Ember.RSVP.all;
const isEmpty = Ember.isEmpty;
const equal = Ember.computed.equal;

const REGIONS = ['us-east-2', 'us-east-1', 'us-west-2', 'ap-east-1', 'ap-south-1', 'ap-northeast-1', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2', 'ca-central-1', 'cn-north-1', 'cn-northwest-1', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1', 'me-south-1', 'sa-east-1'];
const RANCHER_GROUP = 'rancher-nodes';
const VERSIONS = ['1.15', '1.14', '1.13']; // sort newest->oldest so we dont have to run any logic to sort like other provider versions

/*!!!!!!!!!!!GLOBAL CONST END!!!!!!!!!!!*/

/*!!!!!!!!!!!DO NOT CHANGE START!!!!!!!!!!!*/
export default Ember.Component.extend(ClusterDriver, {
    intl: service(),
    driverName: '%%DRIVERNAME%%',
    configField: '%%DRIVERNAME%%EngineConfig', // 'googleKubernetesEngineConfig'
    app: service(),
    router: service(),
    /*!!!!!!!!!!!DO NOT CHANGE END!!!!!!!!!!!*/
    versionChoiceService: service('version-choices'),
    settings: service(),
    defaultK8sVersionRange: alias(`settings.${C.SETTING.VERSION_SYSTEM_K8S_DEFAULT_RANGE}`),
    step: 1,
    errors: [],
    kubernetesVersionContent: VERSIONS,
    editing: equal('mode', 'edit'),
    config: alias('cluster.%%DRIVERNAME%%EngineConfig'),

    init() {
        /*!!!!!!!!!!!DO NOT CHANGE START!!!!!!!!!!!*/
        // This does on the fly template compiling, if you mess with this :cry:
        const decodedLayout = window.atob(LAYOUT);
        const template = Ember.HTMLBars.compile(decodedLayout, {
            moduleName: 'shared/components/cluster-driver/driver-%%DRIVERNAME%%/template'
        });
        set(this, 'layout', template);

        this._super(...arguments);
        /*!!!!!!!!!!!DO NOT CHANGE END!!!!!!!!!!!*/
        console.log(Object.isExtensible(this));
        setProperties(this, {
            clients: {},
            allSubnets: []
        })

        let config = get(this, 'cluster.%%DRIVERNAME%%EngineConfig');
        let configField = get(this, 'configField');

        console.log('antes -- ' + Object.isExtensible(config))

        if (!config) {
            config = this.get('globalStore').createRecord({
                type: configField,
                accessToken: null,
                region: 'us-west-2',
                instanceType: 'm5.large',
                desiredNodes: 1,
                minimumNodes: 1,
                maximumNodes: 1,
                nodePoolName: '',
                kubernetesVersion: this.kubernetesVersionContent.firstObject,
            });
            console.log('store -- ' + Object.isExtensible(config))

            set(this, 'cluster.%%DRIVERNAME%%EngineConfig', config);
        } else {
            if (this.mode === 'edit') {
                setProperties(this, {
                    vpcSubnetMode: 'custom',
                    serviceRoleMode: 'custom',
                });

                if (get(this, 'cluster.hasSessionToken')) {
                    set(this, 'cluster.%%DRIVERNAME%%EngineConfig.accessKey', null);
                }

            }

        }
    },

    willDestroyElement() {
        setProperties(this, {
            step: 1,
            clients: null,
            allSubnets: null,
        });
    },

    config: alias('cluster.%%DRIVERNAME%%EngineConfig'),

    actions: {

        digitalOceanLogin(cb) {

            if (!this.validate()) {
                cb(false)
                return
            }

            set(this, 'step', 2)
            cb()
        },
        loadVPS(cb) {
            set(this, 'step', 3)
            cb()
        },

        save(cb) {

            if (!this.validate()) {
                return cb(false)
            }

            //this.send('driverSave', cb);
            cb(false)
        },
        cancel() {
            // probably should not remove this as its what every other driver uses to get back
            get(this, 'router').transitionTo('global-admin.clusters.index');
        },
    },

    desiredNodesChanged: observer('cluster.%%DRIVERNAME%%EngineConfig.desiredNodes', function () {
        const desiredNodes = get(this, 'cluster.%%DRIVERNAME%%EngineConfig.desiredNodes');
        const config = get(this, 'cluster.%%DRIVERNAME%%EngineConfig');

        setProperties(config, {
            minimumNodes: desiredNodes,
            maximumNodes: desiredNodes
        })
    }),

    versionChoices: computed('versions', function () {
        let versionChoices = [
            { label: "aaa", value: "aaa" }
        ]

        return versionChoices;
    }),

    willSave() {

    },

    // Add custom validation beyond what can be done from the config API schema
    validate() {
        // Get generic API validation errors
        this._super();
        var errors = get(this, 'errors') || [];
        if (!get(this, 'cluster.name')) {
            errors.push('Name is required');
        }

        if (!get(this, 'config.accessToken') || !get(this, 'config.accessToken').trim()) {
            errors.push('Token is required')
        }

        const step = get(this, 'step');

        if (!get(this, 'config.nodePoolName') && step == 3) {
            errors.push('Node pool name is required')
        }

        // Set the array of errors for display,
        // and return true if saving should continue.
        if (get(errors, 'length')) {
            set(this, 'errors', errors);
            return false;
        } else {
            set(this, 'errors', null);
            return true;
        }
    },

    // Any computed properties or custom logic can go here
});