from rest_framework import viewsets, generics
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from .models import Task, UserProfile
from .serializers import TaskSerializer, UserSerializer, UserProfileSerializer, ChangePasswordSerializer
from rest_framework import status

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_nested_subtasks(self,task,user):
        subtasks=task.subtasks.filter(user=user).order_by('id')
        result=[]

        for subtask in subtasks:
            subtask_data=TaskSerializer(subtask).data
            has_nested=subtask.subtasks.filter(user=user).exists()
            subtask_data['has_subtasks']=has_nested

            if has_nested:
                subtask_data['subtasks']=self.get_nested_subtasks(subtask,user)
            else:
                subtask_data['subtasks']=[]
        
        result.append(subtask_data)
        
        return result
    
    def destroy(self, request, *args, **kwargs):
        try:
            print(f" DELETE request for task ID: {kwargs.get('pk')}")
            
            task = Task.objects.get(id=kwargs.get('pk'), user=request.user)
            print(f"Task found: {task.id} - {task.title}")  
            task.delete()
            print("Task deleted")
            
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except Task.DoesNotExist:
            print("Task not found")
            return Response({'detail': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Unexpected error: {e}")
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get_queryset(self):
        print(f"get_queryset called for action: {getattr(self, 'action', 'unknown')}")
        print(f"Request method: {self.request.method}")
        
        queryset = Task.objects.filter(user=self.request.user)
        print(f"Base queryset count: {queryset.count()}")
        
        # parent filtering
        if getattr(self, 'action', None) == 'list':
            parent_param = self.request.query_params.get('parent_task', None)
            print(f"Parent param: {parent_param}")
            
            if parent_param is None:
                queryset = queryset.filter(parent_task__isnull=True)
                print(f"After parent null filter: {queryset.count()}")
            else:
                queryset = queryset.filter(parent_task_id=parent_param)
                print(f"After parent ID filter: {queryset.count()}")

        # filtering (completed, category, search) and sorting
        completed_param = self.request.query_params.get('completed')
        category_param = self.request.query_params.get('category')
        search_param = self.request.query_params.get('search')

        if completed_param is not None:
            is_completed = str(completed_param).strip().lower() in ('true', '1', 'yes')
            queryset = queryset.filter(completed=is_completed)

        if category_param:
            queryset = queryset.filter(category__iexact=category_param)

        if search_param:
            queryset = queryset.filter(Q(title__icontains=search_param) | Q(description__icontains=search_param))

        sort_by_param = self.request.query_params.get('sort_by')
        order_param = self.request.query_params.get('order', 'asc')

        if sort_by_param:
            allowed_sort_fields = ['due_date', 'completed', 'category', 'created_at', 'title']
            if sort_by_param in allowed_sort_fields:
                sort_field = '-' + sort_by_param if order_param.lower() == 'desc' else sort_by_param
                queryset = queryset.order_by(sort_field)
        else:
            queryset = queryset.order_by('-created_at', 'id')

        print(f"Final queryset count: {queryset.count()}")
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False,methods=['get'])
    def stats(self, request):
        user_tasks=Task.objects.filter(user=request.user)
        data={
            'total_tasks': user_tasks.count(),
            'pending_tasks': user_tasks.filter(completed=False).count(),
            'completed_tasks': user_tasks.filter(completed=True).count(),
            'overdue_tasks': user_tasks.filter(completed=False, due_date__lt=timezone.localdate()).count(),
        }
        return Response(data)

    @action(detail=True,methods=['get'])
    def subtasks(self,request,pk=None):     
        parent_task =self.get_object()
        subtasks = parent_task.subtasks.filter(user=request.user).order_by('id')
        serializer = self.get_serializer(subtasks, many=True)
        return Response(serializer.data)


class UserRegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]


# ============ PROFILE VIEWS ============
@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def user_profile(request):
    """
    GET: Retrieve user profile
    PUT: Update profile picture
    """
    profile, created = UserProfile.objects.get_or_create(user=request.user)
    
    if request.method == 'GET':
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data)
    
    elif request.method == 'PUT':
        if 'profile_picture' in request.FILES:
            profile.profile_picture = request.FILES['profile_picture']
            profile.save()
            serializer = UserProfileSerializer(profile)
            return Response(serializer.data)
        else:
            return Response(
                {'error': 'No image file provided'}, 
                status=status.HTTP_400_BAD_REQUEST
            )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """
    Change user password
    """
    serializer = ChangePasswordSerializer(data=request.data)
    
    if serializer.is_valid():
        user = request.user
        
        # Check old password
        if not user.check_password(serializer.validated_data['old_password']):
            return Response(
                {'error': 'Current password is incorrect'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Set new password
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        
        return Response({'message': 'Password changed successfully'})
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """
    Delete user account and all related data
    """
    user = request.user
    username = user.username
    
    # Delete user (cascades to profile and tasks)
    user.delete()
    
    return Response(
        {'message': f'Account {username} has been deleted successfully'}, 
        status=status.HTTP_200_OK
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recent_activity(request):
    """
    Get recently completed and created tasks
    """
    user = request.user
    
    # Recently completed tasks (last 5)
    recently_completed = Task.objects.filter(
        user=user, 
        completed=True
    ).order_by('-updated_at')[:5]
    
    # Recently created tasks (last 5)
    recently_created = Task.objects.filter(
        user=user
    ).order_by('-created_at')[:5]
    
    return Response({
        'recently_completed': TaskSerializer(recently_completed, many=True).data,
        'recently_created': TaskSerializer(recently_created, many=True).data
    })