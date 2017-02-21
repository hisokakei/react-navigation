/* @flow */

import React, { PropTypes, Component } from 'react';
import {
  StyleSheet,
  NativeModules,
  Platform,
  View,
} from 'react-native';

import Transitioner from './Transitioner';
import Card from './Card';
import CardStackStyleInterpolator from './CardStackStyleInterpolator';
import CardStackPanResponder from './CardStackPanResponder';
import Header from './Header';
import NavigationPropTypes from '../PropTypes';
import NavigationActions from '../NavigationActions';
import addNavigationHelpers from '../addNavigationHelpers';
import SceneView from './SceneView';

import type {
  NavigationAction,
  NavigationScreenProp,
  NavigationScene,
  NavigationSceneRenderer,
  NavigationSceneRendererProps,
  NavigationTransitionProps,
  NavigationRouter,
  Style,
} from '../TypeDefinition';

import type {
  HeaderMode,
} from './Header';

import type { TransitionConfig } from './TransitionConfigs';

import TransitionConfigs from './TransitionConfigs';

import TransitionItems from './Transition/TransitionItems';

const NativeAnimatedModule = NativeModules && NativeModules.NativeAnimatedModule;

type Props = {
  screenProps?: {};
  headerMode: HeaderMode,
  headerComponent?: ReactClass<*>,
  mode: 'card' | 'modal',
  navigation: NavigationScreenProp<*, NavigationAction>,
  router: NavigationRouter,
  cardStyle?: Style,
  onTransitionStart?: () => void,
  onTransitionEnd?: () => void,
  style: Style,
  gestureResponseDistance?: ?number,
  /**
   * If true, enable navigating back by swiping (see CardStackPanResponder).
   * TODO move this to TransitionConfig.
   */
  gesturesEnabled: ?boolean,
  /**
   * Optional custom animation when transitioning between screens.
   */
  transitionConfig?: () => TransitionConfig,
};

type DefaultProps = {
  mode: 'card' | 'modal',
  gesturesEnabled: boolean,
  headerComponent: ReactClass<*>,
};

type State = {
  transitionItems: TransitionItems,
};

class CardStack extends Component<DefaultProps, Props, void> {
  _render: NavigationSceneRenderer;
  _renderScene: NavigationSceneRenderer;
  _childNavigationProps: {
    [key: string]: NavigationScreenProp<*, NavigationAction>
  } = {};
  state: State;

  static Card = Card;
  static Header = Header;

  static propTypes = {
    /**
     * Custom style applied to the card.
     */
    cardStyle: PropTypes.any,

    /**
     * Style of the stack header. `float` means the header persists and is shared
     * for all screens. When set to `screen`, each header is rendered within the
     * card, and will animate in together.
     *
     * The default for `modal` mode is `screen`, and the default for `card` mode
     * is `screen` on Android and `float` on iOS.
     */
    headerMode: PropTypes.oneOf(['float', 'screen', 'none']),

    /**
     * Custom React component to be used as a header
     */
    headerComponent: PropTypes.func,

    /**
     * Style of the cards movement. Value could be `card` or `modal`.
     * Default value is `card`.
     */
    mode: PropTypes.oneOf(['card', 'modal']),

    /**
     * The distance from the edge of the card which gesture response can start
     * for. Default value is `30`.
     */
    gestureResponseDistance: PropTypes.number,

    /**
     * Optional custom animation when transitioning between screens.
     */
    transitionConfig: PropTypes.func,

    /**
     * Enable gestures. Default value is true on iOS, false on Android.
     */
    gesturesEnabled: PropTypes.bool,

    /**
     * The navigation prop, including the state and the dispatcher for the back
     * action. The dispatcher must handle the back action
     * ({ type: NavigationActions.BACK }), and the navigation state has this shape:
     *
     * ```js
     * const navigationState = {
     *   index: 0, // the index of the selected route.
     *   routes: [ // A list of routes.
     *     {key: 'page 1'}, // The 1st route.
     *     {key: 'page 2'}, // The second route.
     *   ],
     * };
     * ```
     */
    navigation: PropTypes.shape({
      state: NavigationPropTypes.navigationState.isRequired,
      dispatch: PropTypes.func.isRequired,
    }).isRequired,

    /**
     * Custom style applied to the cards stack.
     */
    style: View.propTypes.style,
  };

  static childContextTypes = {
    registerTransitionItem: React.PropTypes.func,
    unregisterTransitionItem: React.PropTypes.func,
  }

  static defaultProps: DefaultProps = {
    mode: 'card',
    gesturesEnabled: Platform.OS === 'ios',
    headerComponent: Header,
  };

  constructor(props: Props, context) {
    super(props, context);
    this.state = {
      transitionItems: new TransitionItems(),
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (this.props !== nextProps) {
      return true;
    } else {
      // TODO change this when/if state has other things.
      return false;
    }
  }

  getChildContext() {
    const self = this;
    return {
      registerTransitionItem(item: TransitionItem) {
        self.setState((prevState: State) => ({
          transitionItems: prevState.transitionItems.add(item),
        }));
        // const {name, containerRouteName} = TransitionItem;
        // const matchingItem = self.state.TransitionItems.findMatchByName(name, containerRouteName);
        // // schedule to measure (on layout) if another Item with the same name is mounted
        // if (matchingItem) {
        //   self.setState((prevState: State) => ({
        //     TransitionItems: prevState.TransitionItems,
        //     itemsToMeasure: [...prevState.itemsToMeasure, TransitionItem, matchingItem]
        //   }));
        // }
      },
      unregisterTransitionItem(id: string, routeName: string) {
        self.setState((prevState: State) => ({
          transitionItems: prevState.transitionItems.remove(id, routeName),
        }));
      },
    };
  }

  componentWillMount() {
    this._render = this._render.bind(this);
    this._renderScene = this._renderScene.bind(this);
  }

  render() {
    return (
      <Transitioner
        configureTransition={this._configureTransition}
        navigation={this.props.navigation}
        render={this._render}
        style={this.props.style}
        onTransitionStart={this.props.onTransitionStart}
        onTransitionEnd={this.props.onTransitionEnd}
      />
    );
  }

  _configureTransition = (
    // props for the new screen
    transitionProps: NavigationTransitionProps,
    // props for the old screen
    prevTransitionProps: NavigationTransitionProps
  ) => {
    const isModal = this.props.mode === 'modal';
    // Copy the object so we can assign useNativeDriver below
    // (avoid Flow error, transitionSpec is of type NavigationTransitionSpec).
    const transitionSpec = {
      ...this._getTransitionConfig(
        transitionProps,
        prevTransitionProps
      ).transitionSpec,
    };
    if (
       !!NativeAnimatedModule
       // Native animation support also depends on the transforms used:
       && CardStackStyleInterpolator.canUseNativeDriver(isModal)
    ) {
      // Internal undocumented prop
      transitionSpec.useNativeDriver = true;
    }
    return transitionSpec;
  }

  _renderHeader(
    transitionProps: NavigationTransitionProps,
    headerMode: HeaderMode
  ): ?React.Element<*> {
    const headerConfig = this.props.router.getScreenConfig(
      transitionProps.navigation,
      'header'
    ) || {};

    return (
      <this.props.headerComponent
        {...transitionProps}
        router={this.props.router}
        style={headerConfig.style}
        mode={headerMode}
        onNavigateBack={() => this.props.navigation.goBack(null)}
        renderLeftComponent={(props: NavigationTransitionProps) => {
          const header = this.props.router.getScreenConfig(props.navigation, 'header') || {};
          return header.left;
        }}
        renderRightComponent={(props: NavigationTransitionProps) => {
          const header = this.props.router.getScreenConfig(props.navigation, 'header') || {};
          return header.right;
        }}
        renderTitleComponent={(props: NavigationTransitionProps) => {
          const header = this.props.router.getScreenConfig(props.navigation, 'header') || {};
          // When we return 'undefined' from 'renderXComponent', header treats them as not
          // specified and default 'renderXComponent' functions are used. In case of 'title',
          // we return 'undefined' in case of 'string' too because the default 'renderTitle'
          // function in header handles them.
          if (typeof header.title === 'string') {
            return undefined;
          }
          return header.title;
        }}
      />
    );
  }

  _render(
      props: NavigationTransitionProps, 
      prevTransitionProps:NavigationTransitionProps): React.Element<*> {
    let floatingHeader = null;
    const headerMode = this._getHeaderMode();
    if (headerMode === 'float') {
      floatingHeader = this._renderHeader(props, headerMode);
    }
    const prevRouteName = prevTransitionProps && prevTransitionProps.scene.route.routeName;
    return (
      <View style={styles.container}>
        <View
          style={styles.scenes}
        >
          {props.scenes.map(
            (scene: *) => this._renderScene({
              ...props,
              scene,
              navigation: this._getChildNavigation(scene),
            }, prevRouteName)
          )}
        </View>
        {floatingHeader}
      </View>
    );
  }

  _getHeaderMode(): HeaderMode {
    if (this.props.headerMode) {
      return this.props.headerMode;
    }
    if (Platform.OS === 'android' || this.props.mode === 'modal') {
      return 'screen';
    }
    return 'float';
  }

  _getTransitionConfig(
    // props for the new screen
    transitionProps: NavigationTransitionProps,
    // props for the old screen
    prevTransitionProps: NavigationTransitionProps
  ): TransitionConfig {
    const defaultConfig = TransitionConfigs.defaultTransitionConfig(
      transitionProps,
      prevTransitionProps,
      this.props.mode === 'modal'
    );
    if (this.props.transitionConfig) {
      return {
        ...defaultConfig,
        ...this.props.transitionConfig(),
      };
    }

    return defaultConfig;
  }

  _renderInnerCard(
    SceneComponent: ReactClass<*>,
    props: NavigationSceneRendererProps,
  ): React.Element<*> {
    const header = this.props.router.getScreenConfig(props.navigation, 'header');
    const headerMode = this._getHeaderMode();
    if (headerMode === 'screen') {
      const isHeaderHidden = header && header.visible === false;
      const maybeHeader =
        isHeaderHidden ? null : this._renderHeader(props, headerMode);
      return (
        <View style={{ flex: 1 }}>
          {maybeHeader}
          <SceneView
            screenProps={this.props.screenProps}
            navigation={props.navigation}
            component={SceneComponent}
          />
        </View>
      );
    }
    return (
      <SceneView
        screenProps={this.props.screenProps}
        navigation={props.navigation}
        component={SceneComponent}
      />
    );
  }

  _getChildNavigation = (
    scene: NavigationScene
  ): NavigationScreenProp<*, NavigationAction> => {
    let navigation = this._childNavigationProps[scene.key];
    if (!navigation || navigation.state !== scene.route) {
      navigation = this._childNavigationProps[scene.key] = addNavigationHelpers({
        ...this.props.navigation,
        state: scene.route,
      });
    }
    return navigation;
  }

  _renderScene(props: NavigationSceneRendererProps, prevRouteName: string): React.Element<*> {
    const isModal = this.props.mode === 'modal';

    let panHandlers = null;

    if (this.props.gesturesEnabled) {
      let onNavigateBack = null;
      if (this.props.navigation.state.index !== 0) {
        onNavigateBack = () => this.props.navigation.dispatch(
          NavigationActions.back({ key: props.scene.route.key })
        );
      }
      const panHandlersProps = {
        ...props,
        onNavigateBack,
        gestureResponseDistance: this.props.gestureResponseDistance,
      };
      panHandlers = isModal ?
        CardStackPanResponder.forVertical(panHandlersProps) :
        CardStackPanResponder.forHorizontal(panHandlersProps);
    }

    const SceneComponent = this.props.router.getComponentForRouteName(props.scene.route.routeName);

    return (
      <Card
        {...props}
        key={`card_${props.scene.key}`}
        panHandlers={panHandlers}
        renderScene={(sceneProps: *) => this._renderInnerCard(SceneComponent, sceneProps)}
        style={this.props.cardStyle}
        transitionProps={props}
        transitionConfigs={this.props.transitionConfigs}
        prevRouteName={prevRouteName}
      />
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Header is physically rendered after scenes so that Header won't be
    // covered by the shadows of the scenes.
    // That said, we'd have use `flexDirection: 'column-reverse'` to move
    // Header above the scenes.
    flexDirection: 'column-reverse',
  },
  scenes: {
    flex: 1,
  },
});

export default CardStack;
