import React from 'react';
import {Text, View} from 'react-native';
import UniversalNavbar from '../subcomponents/UniversalNavbar'

const TodosScreen = ({ navigation }) => {

    return (
        <View style={{flex: 1, backgroundColor: "white"}}>
            <UniversalNavbar navigation={navigation} />
            <Text>{"TBD >:D"}</Text>
        </View>
    )
}

export default TodosScreen