import 'react-native-gesture-handler';
import React, {useState} from 'react'

import CalendarScreen from './components/screens/CalendarScreen';
import TimeblockScreen from './components/screens/TimeblockScreen';
import TodosScreen from './components/screens/TodosScreen';
import NotesScreen from './components/screens/NotesScreen';
import CategoriesScreen from './components/screens/CategoriesScreen';
import AnalyticsScreen from './components/screens/AnalyticsScreen';
import RoutinesScreen from './components/screens/RoutinesScreen'
import SettingsScreen from './components/screens/SettingsScreen';
import TimerScreen from './components/screens/TimerScreen';

import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';

const Drawer = createDrawerNavigator();

const App = () => {

  // this is used in TimeblockScreen
  Array.prototype.insert = function ( index, item ) {
    this.splice( index, 0, item );
  };

  Array.prototype.removeOnce = function (value) {
    var index = this.indexOf(value);
    if (index > -1) {
      this.splice(index, 1);
    }
  }

  return (
    <NavigationContainer>
      <Drawer.Navigator initialRouteName="Calendar">
        <Drawer.Screen name="Calendar" component={CalendarScreen} />
        <Drawer.Screen name="Timeblocks" component={TimeblockScreen} />
        <Drawer.Screen name="Todos" component={TodosScreen} />
        <Drawer.Screen name="Categories" component={CategoriesScreen} />
      </Drawer.Navigator>
    </NavigationContainer>
  )
}

export default App
