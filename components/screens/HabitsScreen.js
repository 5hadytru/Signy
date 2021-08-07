import {Text, View} from 'react-native'
import React from 'react'

import UniversalNavbar from '../subcomponents/UniversalNavbar'


const HabitsScreen = ({ navigation }) => {
    return (
        <View>
            <UniversalNavbar navigation={navigation} />
        </View>
    )
}

export default HabitsScreen