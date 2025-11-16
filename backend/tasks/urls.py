from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, UserRegistrationView, user_profile, change_password, delete_account, recent_activity

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')

urlpatterns = [
    path('', include(router.urls)),
    path('register/', UserRegistrationView.as_view(), name='user-register'),
    
    # Profile routes
    path('profile/', user_profile, name='user-profile'),
    path('profile/change-password/', change_password, name='change-password'),
    path('profile/delete-account/', delete_account, name='delete-account'),
    path('profile/recent-activity/', recent_activity, name='recent-activity'),
]