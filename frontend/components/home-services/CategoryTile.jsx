import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';

import styles from './styles';

export default function CategoryTile({ category, selected, onPress }) {
  return (
    <TouchableOpacity style={styles.categoryTile} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.categoryIcon, { backgroundColor: category.color }, selected && styles.categoryIconSelected]}>
        <Ionicons name={category.icon} size={28} color="#314b5f" />
      </View>
      <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]} numberOfLines={1}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );
}