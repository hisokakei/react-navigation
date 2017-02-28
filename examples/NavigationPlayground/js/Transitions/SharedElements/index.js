import {
  StackNavigator,
} from 'react-navigation';

import PhotoGrid from './PhotoGrid';
import PhotoDetail from './PhotoDetail';
import { Transition } from 'react-navigation';
import _ from 'lodash';
import faker from 'faker';

const {createTransition, together} = Transition;

const SharedElements = (filter) => ({
  filter,
  getItemsToClone(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*> ) {
    const itemIdsOnBoth = _.intersectionWith(itemsOnFromRoute, itemsOnToRoute, (i1, i2) => i1.id === i2.id)
      .map(item => item.id);
    const onBoth = item => itemIdsOnBoth.includes(item.id);
    return itemsOnFromRoute.filter(onBoth);
  },
  getItemsToMeasure(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*> ) {
    const itemIdsOnBoth = _.intersectionWith(itemsOnFromRoute, itemsOnToRoute, (i1, i2) => i1.id === i2.id)
      .map(item => item.id);
    const onBoth = item => itemIdsOnBoth.includes(item.id);
    return itemsOnFromRoute.filter(onBoth).concat(itemsOnToRoute.filter(onBoth));
  },
  createAnimatedStyleMapForClones(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>, 
    transitionProps) {
    const itemIdsOnBoth = _.intersectionWith(itemsOnFromRoute, itemsOnToRoute, (i1, i2) => i1.id === i2.id)
      .map(item => item.id);
    const {progress} = transitionProps;
    const createSharedItemStyle = (result, id) => {
      const fromItem = itemsOnFromRoute.find(item => item.id === id);
      const toItem = itemsOnToRoute.find(item => item.id === id);
      if (!fromItem.isMeasured() || !toItem.isMeasured()) return null; // TODO temporary line to avoid crashes, should remove
      console.log('fromItem', fromItem.toString(), 'toItem', toItem.toString());
      const inputRange = [0, 1];
      const left = progress.interpolate({
        inputRange, outputRange: [fromItem.metrics.x, toItem.metrics.x]
      });
      const top = progress.interpolate({
        inputRange, outputRange: [fromItem.metrics.y, toItem.metrics.y]
      });
      const width = progress.interpolate({
        inputRange, outputRange: [fromItem.metrics.width, toItem.metrics.width]
      });
      const height = progress.interpolate({
        inputRange, outputRange: [fromItem.metrics.height, toItem.metrics.height]
      });
      result[id] = { left, top, width, height, right: null, bottom: null };
      return result;
    };
    return {
      from: itemIdsOnBoth.reduce(createSharedItemStyle, {}),
    }
  }
});

const CrossFade = (filter) => ({
  filter,
  createAnimatedStyleMap(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>, 
    transitionProps) {
    const { progress } = transitionProps;
    const createStyles = (items: Array<*>, toAppear: boolean) => items.reduce((result, item) => {
      const opacity = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [toAppear ? 0 : 1, toAppear ? 1 : 0],
      })
      const rotate = progress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      });
      result[item.id] = {
        opacity,
        transform: [{ rotate }],
      }
      return result;
    }, {});
    return {
      from: createStyles(itemsOnFromRoute, false),
      to: createStyles(itemsOnToRoute, true),
    };
  }
})

const DelayedFadeInToRoute = (filter) => ({
  filter,
  createAnimatedStyleMap(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>, 
    transitionProps) {
    return {
      to: itemsOnToRoute.reduce((result, item) => {
        const opacity = transitionProps.progress.interpolate({
          inputRange: [0, 0.8, 1],
          outputRange: [0, 0, 1],
        })
        result[item.id] = { opacity };
        return result;
      }, {}),
    }
  }
});

const FastFadeOutFromRoute = (filter) => ({
  filter,
  createAnimatedStyleMap(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>, 
    transitionProps) {
    return {
      from: itemsOnFromRoute.reduce((result, item) => {
        const opacity = transitionProps.progress.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [1, 0, 0],
        })
        result[item.id] = { opacity };
        return result;
      }, {}),
    }
  }
});

const SharedImage = createTransition(SharedElements, /image-.+/);
const CrossFadeScene = createTransition(CrossFade, /\$scene.+/);

const DelayedFadeInDetail = createTransition(DelayedFadeInToRoute, /\$scene-PhotoDetail/);
const FastFadeOutDetail = createTransition(FastFadeOutFromRoute, /\$scene-PhotoDetail/);

// TODO slide doesn't seem easy to implement, perhaps need to expose current route index and interpolate position instead of progress?
const Slide = (filter) => ({
  filter,
  createAnimatedStyleMap(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>, 
    transitionProps) {
    const {layout: {initWidth}, progress} = transitionProps;
    const createStyle = (items, onFromRoute: boolean) => items.reduce((result, item) => {
      const translateX = progress.interpolate({
        inputRange: [0, 0.05, 1],
        outputRange: onFromRoute ? [0, -initWidth, -initWidth] : [initWidth, 0, 0],
      })
      result[item.id] = { transform: [{ translateX }] }
      return result;
    }, {});
    return {
      from: createStyle(itemsOnFromRoute, true),
      to: createStyle(itemsOnToRoute, false),
    };
  }
});

const StaggeredAppear = (filter) => ({
  filter,
  createAnimatedStyleMap(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>, 
    transitionProps) {
    const createStyle = (startTime, axis, direction) => {
      const {progress} = transitionProps;
      const inputRange = [0, startTime, 1];
      const opacity = progress.interpolate({
        inputRange,
        outputRange:  [0, 0, 1],
      });
      const translate = progress.interpolate({
        inputRange,
        outputRange: [ direction * 400, direction * 400, 0],
      });
      axis = axis === 'x' ? 'translateX' : 'translateY';
      return {
        opacity,
        transform: [ { [axis]: translate } ],
      };
    }
    const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
    const axes = ['x', 'y'];
    const directions = [-1, 1];
    return {
      to: itemsOnToRoute.reduce((result, item) => {
        const startTime = clamp(Math.random(), 0.1, 0.9);
        const axis = faker.random.arrayElement(axes);
        const direction = faker.random.arrayElement(directions);
        result[item.id] = createStyle(startTime, axis, direction);
        return result;
      }, {}),
    };
  }
})

const SlideScenes = createTransition(Slide, /\$scene-.*/);
const StaggeredAppearImages = createTransition(StaggeredAppear, /image-.+/);

const transitions = [
  // { from: 'PhotoGrid', to: 'PhotoDetail', transition: CrossFadeScene },
  // { from: 'PhotoDetail', to: 'PhotoGrid', transition: CrossFadeScene },
  // { from: 'PhotoGrid', to: 'PhotoDetail', transition: together(SharedImage, DelayedFadeInDetail)},
  // { from: 'PhotoDetail', to: 'PhotoGrid', transition: together(SharedImage, FastFadeOutDetail) },
  { from: 'PhotoGrid', to: 'PhotoDetail', transition: CrossFadeScene },
  { from: 'PhotoDetail', to: 'PhotoGrid', transition: together(StaggeredAppearImages, SlideScenes) },
];

const App = StackNavigator({
  PhotoGrid: {
    screen: PhotoGrid,
  },
  PhotoDetail: {
    screen: PhotoDetail,
  }
}, {
    transitions,
  });

export default App;