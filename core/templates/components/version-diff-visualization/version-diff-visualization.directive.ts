// Copyright 2016 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Directive for the visualization of the diff between two
 *   versions of an exploration.
 */

require(
  'components/common-layout-directives/common-elements/' +
  'confirm-or-cancel-modal.controller.ts');
require(
  'components/common-layout-directives/common-elements/' +
  'loading-dots.directive.ts');
require(
  'components/version-diff-visualization/codemirror-mergeview.directive.ts');

require('domain/utilities/url-interpolation.service.ts');

angular.module('oppia').directive('versionDiffVisualization', [
  '$timeout', 'UrlInterpolationService',
  function($timeout, UrlInterpolationService) {
    return {
      restrict: 'E',
      scope: {},
      bindToController: {
        // An object with the following properties:
        // - nodes: an object whose keys are state IDs and whoe value is an
        //     object with the following keys:
        //     - 'newestStateName': the latest name of the state
        //     - 'originalStateName': the first encountered name for the state
        //     - 'stateProperty': 'changed', 'unchanged', 'added' or 'deleted'
        // - links: a list of objects representing links in the diff graph. Each
        //     object represents one link, and has keys:
        //     - 'source': source state of link
        //     - 'target': target state of link
        //     - 'linkProperty': 'added', 'deleted' or 'unchanged'
        // - v1InitStateId: the id of the initial state in the earlier version
        // - v2InitStateId: the id of the initial state in the later version
        // - finalStateIds: whether a state is terminal in either the earlier or
        //     later version
        // - v1States: the states dict for the earlier version of the
        // exploration
        // - v2States: the states dict for the later version of the exploration
        getDiffData: '&diffData',
        // The header for the pane of the state comparison modal corresponding
        // to the earlier version of the exploration.
        getEarlierVersionHeader: '&earlierVersionHeader',
        // The header for the pane of the state comparison modal corresponding
        // to the later version of the exploration.
        getLaterVersionHeader: '&laterVersionHeader',
      },
      templateUrl: UrlInterpolationService.getDirectiveTemplateUrl(
        '/components/version-diff-visualization/' +
        'version-diff-visualization.directive.html'),
      controllerAs: '$ctrl',
      controller: ['$uibModal', function($uibModal) {
        var ctrl = this;
        // Constants for color of nodes in diff graph
        var COLOR_ADDED = '#4EA24E';
        var COLOR_DELETED = '#DC143C';
        var COLOR_CHANGED = '#1E90FF';
        var COLOR_UNCHANGED = 'beige';
        var COLOR_RENAMED_UNCHANGED = '#FFD700';

        // Constants for names in legend
        var NODE_TYPE_ADDED = 'Added';
        var NODE_TYPE_DELETED = 'Deleted';
        var NODE_TYPE_CHANGED = 'Changed';
        var NODE_TYPE_CHANGED_RENAMED = 'Changed/renamed';
        var NODE_TYPE_RENAMED = 'Renamed';
        var NODE_TYPE_UNCHANGED = 'Unchanged';

        var STATE_PROPERTY_ADDED = 'added';
        var STATE_PROPERTY_DELETED = 'deleted';
        var STATE_PROPERTY_CHANGED = 'changed';
        var STATE_PROPERTY_UNCHANGED = 'unchanged';

        // Object whose keys are legend node names and whose values are
        // 'true' or false depending on whether the state property is used in
        // the diff graph. (Will be used to generate legend)
        var _stateTypeUsed = {};
        var diffGraphNodes = {};
        var nodesData;
        // Opens the modal showing the history diff for a given state.
        // stateId is the unique ID assigned to a state during the
        // calculation of the state graph.
        ctrl.onClickStateInDiffGraph = function(stateId) {
          var oldStateName = undefined;
          if (nodesData[stateId].newestStateName !==
              nodesData[stateId].originalStateName) {
            oldStateName = nodesData[stateId].originalStateName;
          }
          ctrl.showStateDiffModal(nodesData[stateId].newestStateName,
            oldStateName, nodesData[stateId].stateProperty);
        };

        // Shows a modal comparing changes on a state between 2 versions.
        //
        // Arguments:
        // - stateName is the name of the state in the newer version.
        // - oldStateName is undefined if the name of the state is unchanged
        //     between the 2 versions, or the name of the state in the older
        //     version if the state name is changed.
        // - stateProperty is whether the state is added, changed, unchanged or
        //   deleted.
        ctrl.showStateDiffModal = function(
            newStateName, oldStateName, stateProperty) {
          $uibModal.open({
            templateUrl: UrlInterpolationService.getDirectiveTemplateUrl(
              '/pages/exploration-editor-page/modal-templates/' +
              'state-diff-modal.template.html'),
            backdrop: true,
            windowClass: 'state-diff-modal',
            resolve: {
              newStateName: function() {
                return newStateName;
              },
              oldStateName: function() {
                return oldStateName;
              },
              newState: function() {
                if (stateProperty !== STATE_PROPERTY_DELETED &&
                    ctrl.getDiffData().v2States.hasOwnProperty(
                      newStateName)) {
                  return ctrl.getDiffData().v2States[newStateName];
                } else {
                  return null;
                }
              },
              oldState: function() {
                var stateNameToRetrieve = oldStateName || newStateName;
                if (stateProperty !== STATE_PROPERTY_ADDED &&
                    ctrl.getDiffData().v1States.hasOwnProperty(
                      stateNameToRetrieve)) {
                  return ctrl.getDiffData().v1States[stateNameToRetrieve];
                } else {
                  return null;
                }
              },
              headers: function() {
                return {
                  leftPane: ctrl.getLaterVersionHeader(),
                  rightPane: ctrl.getEarlierVersionHeader()
                };
              }
            },
            controller: [
              '$controller', '$scope', '$http', '$uibModalInstance',
              'newStateName', 'oldStateName', 'newState', 'oldState',
              'headers', 'ContextService',
              'UrlInterpolationService',
              function(
                  $controller, $scope, $http, $uibModalInstance,
                  newStateName, oldStateName, newState, oldState,
                  headers, ContextService,
                  UrlInterpolationService) {
                $controller('ConfirmOrCancelModalController', {
                  $scope: $scope,
                  $uibModalInstance: $uibModalInstance
                });
                var STATE_YAML_URL = UrlInterpolationService.interpolateUrl(
                  '/createhandler/state_yaml/<exploration_id>', {
                    exploration_id: (
                      ContextService.getExplorationId())
                  });

                $scope.headers = headers;
                $scope.newStateName = newStateName;
                $scope.oldStateName = oldStateName;
                /*
                 * $scope.yamlStrs is an object with keys 'earlierVersion' and
                 * 'laterVersion', whose values are the YAML representations of
                 * the compared versions.
                 */
                $scope.yamlStrs = {};

                if (newState) {
                  $http.post(STATE_YAML_URL, {
                    state_dict: newState.toBackendDict(),
                    width: 50
                  }).then(function(response) {
                    $scope.yamlStrs.leftPane = response.data.yaml;
                  });
                } else {
                  // Note: the timeout is needed or the string will be sent
                  // before codemirror has fully loaded and will not be
                  // displayed. This causes issues with the e2e tests.
                  $timeout(function() {
                    $scope.yamlStrs.leftPane = '';
                  }, 200);
                }

                if (oldState) {
                  $http.post(STATE_YAML_URL, {
                    state_dict: oldState.toBackendDict(),
                    width: 50
                  }).then(function(response) {
                    $scope.yamlStrs.rightPane = response.data.yaml;
                  });
                } else {
                  // Note: the timeout is needed or the string will be sent
                  // before codemirror has fully loaded and will not be
                  // displayed. This causes issues with the e2e tests.
                  $timeout(function() {
                    $scope.yamlStrs.rightPane = '';
                  }, 200);
                }

                // Options for the codemirror mergeview.
                $scope.CODEMIRROR_MERGEVIEW_OPTIONS = {
                  lineNumbers: true,
                  readOnly: true,
                  mode: 'yaml',
                  viewportMargin: 20
                };
              }
            ]
          }).result.then(function() {}, function() {
            // Note to developers:
            // This callback is triggered when the Cancel button is clicked.
            // No further action is needed.
          });
        };
        ctrl.$onInit = function() {
          nodesData = ctrl.getDiffData().nodes;
          _stateTypeUsed[NODE_TYPE_ADDED] = false;
          _stateTypeUsed[NODE_TYPE_DELETED] = false;
          _stateTypeUsed[NODE_TYPE_CHANGED] = false;
          _stateTypeUsed[NODE_TYPE_UNCHANGED] = false;
          _stateTypeUsed[NODE_TYPE_RENAMED] = false;
          _stateTypeUsed[NODE_TYPE_CHANGED_RENAMED] = false;
          ctrl.LEGEND_GRAPH_COLORS = {};
          ctrl.LEGEND_GRAPH_COLORS[NODE_TYPE_ADDED] = COLOR_ADDED;
          ctrl.LEGEND_GRAPH_COLORS[NODE_TYPE_DELETED] = COLOR_DELETED;
          ctrl.LEGEND_GRAPH_COLORS[NODE_TYPE_CHANGED] = COLOR_CHANGED;
          ctrl.LEGEND_GRAPH_COLORS[NODE_TYPE_UNCHANGED] = COLOR_UNCHANGED;
          ctrl.LEGEND_GRAPH_COLORS[NODE_TYPE_RENAMED] = COLOR_RENAMED_UNCHANGED;
          ctrl.LEGEND_GRAPH_COLORS[NODE_TYPE_CHANGED_RENAMED] = COLOR_CHANGED;

          ctrl.LEGEND_GRAPH_SECONDARY_LABELS = {};
          ctrl.LEGEND_GRAPH_SECONDARY_LABELS[NODE_TYPE_CHANGED_RENAMED] = (
            '(was: Old name)');
          ctrl.LEGEND_GRAPH_SECONDARY_LABELS[NODE_TYPE_RENAMED] = (
            '(was: Old name)');
          ctrl.LEGEND_GRAPH_LINK_PROPERTY_MAPPING = {
            hidden: 'stroke: none; marker-end: none;'
          };
          ctrl.DIFF_GRAPH_LINK_PROPERTY_MAPPING = {
            added: (
              'stroke: #1F7D1F; stroke-opacity: 0.8; ' +
              'marker-end: url(#arrowhead-green)'),
            deleted: (
              'stroke: #B22222; stroke-opacity: 0.8; ' +
              'marker-end: url(#arrowhead-red)')
          };
          ctrl.diffGraphSecondaryLabels = {};
          ctrl.diffGraphNodeColors = {};

          for (var nodeId in nodesData) {
            var nodeStateProperty = nodesData[nodeId].stateProperty;
            if (nodeStateProperty === STATE_PROPERTY_ADDED) {
              diffGraphNodes[nodeId] = nodesData[nodeId].newestStateName;
              ctrl.diffGraphNodeColors[nodeId] = COLOR_ADDED;
              _stateTypeUsed[NODE_TYPE_ADDED] = true;
            } else if (nodeStateProperty === STATE_PROPERTY_DELETED) {
              diffGraphNodes[nodeId] = nodesData[nodeId].originalStateName;
              ctrl.diffGraphNodeColors[nodeId] = COLOR_DELETED;
              _stateTypeUsed[NODE_TYPE_DELETED] = true;
            } else if (nodeStateProperty === STATE_PROPERTY_CHANGED) {
              diffGraphNodes[nodeId] = nodesData[nodeId].originalStateName;
              ctrl.diffGraphNodeColors[nodeId] = COLOR_CHANGED;
              if (nodesData[nodeId].originalStateName !==
                  nodesData[nodeId].newestStateName) {
                ctrl.diffGraphSecondaryLabels[nodeId] = '(was: ' +
                  nodesData[nodeId].originalStateName + ')';
                diffGraphNodes[nodeId] = nodesData[nodeId].newestStateName;
                _stateTypeUsed[NODE_TYPE_CHANGED_RENAMED] = true;
              } else {
                _stateTypeUsed[NODE_TYPE_CHANGED] = true;
              }
            } else if (nodeStateProperty === STATE_PROPERTY_UNCHANGED) {
              diffGraphNodes[nodeId] = nodesData[nodeId].originalStateName;
              ctrl.diffGraphNodeColors[nodeId] = COLOR_UNCHANGED;
              if (nodesData[nodeId].originalStateName !==
                  nodesData[nodeId].newestStateName) {
                ctrl.diffGraphSecondaryLabels[nodeId] = '(was: ' +
                  nodesData[nodeId].originalStateName + ')';
                diffGraphNodes[nodeId] = nodesData[nodeId].newestStateName;
                ctrl.diffGraphNodeColors[nodeId] = COLOR_RENAMED_UNCHANGED;
                _stateTypeUsed[NODE_TYPE_RENAMED] = true;
              } else {
                _stateTypeUsed[NODE_TYPE_UNCHANGED] = true;
              }
            } else {
              throw new Error('Invalid state property.');
            }
          }

          ctrl.v1InitStateId = ctrl.getDiffData().v1InitStateId;

          ctrl.diffGraphData = {
            nodes: diffGraphNodes,
            links: ctrl.getDiffData().links,
            initStateId: ctrl.getDiffData().v2InitStateId,
            finalStateIds: ctrl.getDiffData().finalStateIds
          };

          // Generate the legend graph
          ctrl.legendGraph = {
            nodes: {},
            links: []
          };
          var _lastUsedStateType = null;
          for (var stateProperty in _stateTypeUsed) {
            if (_stateTypeUsed[stateProperty]) {
              ctrl.legendGraph.nodes[stateProperty] = stateProperty;
              if (_lastUsedStateType) {
                ctrl.legendGraph.links.push({
                  source: _lastUsedStateType,
                  target: stateProperty,
                  linkProperty: 'hidden'
                });
              }
              _lastUsedStateType = stateProperty;
              if (!ctrl.legendGraph.hasOwnProperty('initStateId')) {
                ctrl.legendGraph.initStateId = stateProperty;
              }
            }
          }
          ctrl.legendGraph.finalStateIds = [_lastUsedStateType];
        };
      }]
    };
  }]);
