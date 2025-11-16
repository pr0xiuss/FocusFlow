from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Task, UserProfile
from rest_framework.exceptions import ValidationError

class RecursiveField(serializers.Serializer):
    def to_representation(self, value):
        serializer = self.parent.parent.__class__(value, context=self.context)
        return serializer.data

class TaskSerializer(serializers.ModelSerializer):
    has_subtasks = serializers.SerializerMethodField()
    subtasks = RecursiveField(many=True, read_only=True)

    def get_has_subtasks(self, obj):
        return obj.subtasks.exists()

    class Meta:
        model = Task
        fields = '__all__'
        read_only_fields = ('user',)

    def validate_completed(self, value):
        if self.instance and value is True:
            if self.instance.subtasks.filter(completed=False).exists():
                raise ValidationError("All Subtasks must be completed first")
        return value



class UserSerializer(serializers.ModelSerializer):
    pwd = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    pwd2 = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['username', 'email', 'pwd', 'pwd2']

    def validate(self, data):
        if data['pwd'] != data['pwd2']:
            raise serializers.ValidationError({"pwd": "Password fields didn't match!"})
        return data

    def create(self, validated_data):
        validated_data.pop('pwd2')
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['pwd']
        )


# ============ PROFILE SERIALIZERS ============
class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    member_since = serializers.DateTimeField(source='created_at', read_only=True)
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ['username', 'email', 'member_since', 'profile_picture']
        read_only_fields = ['username', 'email', 'member_since']
    
    def get_profile_picture(self, obj):
        if obj.profile_picture:
            try:
                return obj.profile_picture.url
            except:
                return "https://res.cloudinary.com/dciud6yuq/image/upload/v1744963258/pfp_kniw7o.jpg"
        
        return "https://res.cloudinary.com/dciud6yuq/image/upload/v1744963258/pfp_kniw7o.jpg"

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)
    
    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "New passwords don't match"})
        if len(data['new_password']) < 6:
            raise serializers.ValidationError({"new_password": "Password must be at least 6 characters long"})
        return data